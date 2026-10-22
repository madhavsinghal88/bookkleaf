import { prisma } from "../lib/prisma.js";
import { aiStatus, estimateCostUsd } from "./ai/llm.js";

export async function listTeam() {
  return prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

// Queue health plus AI usage. The AI block is how the team sees what the
// integration costs and how often humans disagree with it.
export async function getStats() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [byStatus, openByPriority, unassigned, aiCalls, classified, categoryOverrides, priorityOverrides, repliesFromDraft, adminReplies] =
    await Promise.all([
      prisma.ticket.groupBy({ by: ["status"], _count: true }),
      prisma.ticket.groupBy({
        by: ["priority"],
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        _count: true,
      }),
      prisma.ticket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, assigneeId: null } }),
      prisma.aiCallLog.findMany({ where: { createdAt: { gte: since } } }),
      prisma.ticket.count({ where: { classifiedAt: { not: null } } }),
      prisma.ticket.count({ where: { categorySource: "ADMIN" } }),
      prisma.ticket.count({ where: { prioritySource: "ADMIN" } }),
      prisma.ticketMessage.count({ where: { fromAiDraft: true } }),
      prisma.ticketMessage.count({ where: { kind: "REPLY", sender: { role: "ADMIN" } } }),
    ]);

  const purposes = ["CLASSIFY", "DRAFT", "CHAT_SUPPORT", "CHAT_SALES"] as const;
  const usage = purposes.map((purpose) => {
    const rows = aiCalls.filter((r) => r.purpose === purpose);
    const ok = rows.filter((r) => r.success);
    const sum = (key: "inputTokens" | "outputTokens" | "cacheReadTokens") =>
      ok.reduce((acc, r) => acc + (r[key] ?? 0), 0);
    return {
      purpose,
      calls: rows.length,
      failures: rows.length - ok.length,
      avgLatencyMs: ok.length ? Math.round(ok.reduce((a, r) => a + r.latencyMs, 0) / ok.length) : null,
      inputTokens: sum("inputTokens"),
      cacheReadTokens: sum("cacheReadTokens"),
      outputTokens: sum("outputTokens"),
      estimatedCostUsd: Number(ok.reduce((a, r) => a + estimateCostUsd(r), 0).toFixed(4)),
    };
  });

  return {
    tickets: {
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      openByPriority: Object.fromEntries(openByPriority.map((r) => [r.priority ?? "UNCLASSIFIED", r._count])),
      unassignedOpen: unassigned,
    },
    ai: {
      status: aiStatus(),
      last30Days: usage,
      classifiedTickets: classified,
      categoryOverrideRate: classified ? Number((categoryOverrides / classified).toFixed(2)) : null,
      priorityOverrideRate: classified ? Number((priorityOverrides / classified).toFixed(2)) : null,
      repliesStartedFromAiDraft: repliesFromDraft,
      adminReplies,
    },
  };
}
