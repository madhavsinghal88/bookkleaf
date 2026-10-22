import { api } from "../../api/client";
import type { Stats } from "../../api/types";
import { ErrorBanner, Spinner } from "../../components/ui";
import { usePolling } from "../../hooks/usePolling";
import { PRIORITY_LABELS, STATUS_LABELS, PRIORITIES, STATUSES } from "../../lib/format";

const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

const PURPOSE_LABELS: Record<string, string> = {
  CLASSIFY: "Classification",
  DRAFT: "Reply drafts",
  CHAT_SUPPORT: "Author chat",
  CHAT_SALES: "Sales chat",
};

// Queue health plus how the AI is performing and what it costs.
export function InsightsPage() {
  const { data, error } = usePolling(() => api.get<Stats>("/admin/stats"), 30_000);
  if (error && !data) return <ErrorBanner error={error} />;
  if (!data) return <Spinner />;
  const { tickets, ai } = data;
  const totalCost = ai.last30Days.reduce((s, r) => s + r.estimatedCostUsd, 0);

  return (
    <>
      <h1>Insights</h1>

      <h2>Queue</h2>
      <div className="stat-row">
        {STATUSES.map((s) => (
          <div key={s} className="stat card">
            <div className="stat-value">{tickets.byStatus[s] ?? 0}</div>
            <div className="stat-label">{STATUS_LABELS[s]}</div>
          </div>
        ))}
        <div className="stat card">
          <div className="stat-value">{tickets.unassignedOpen}</div>
          <div className="stat-label">Unassigned (active)</div>
        </div>
      </div>
      <p className="muted small">
        Active by priority:{" "}
        {PRIORITIES.map((p) => `${PRIORITY_LABELS[p]} ${tickets.openByPriority[p] ?? 0}`).join(" · ")}
        {tickets.openByPriority.UNCLASSIFIED ? ` · Unclassified ${tickets.openByPriority.UNCLASSIFIED}` : ""}
      </p>

      <h2>AI assistant</h2>
      <div className={`banner ${ai.status.enabled ? "banner-success" : "banner-warn"}`}>
        {ai.status.enabled
          ? "AI is online: tickets are auto-classified and replies are drafted from the knowledge base."
          : `AI is offline (${ai.status.reason}). Tickets use keyword rules, drafts use templates, and both chats answer from the BookLeaf guide.`}
      </div>
      <div className="stat-row">
        <div className="stat card">
          <div className="stat-value">${totalCost.toFixed(4)}</div>
          <div className="stat-label">Est. AI cost, last 30 days</div>
        </div>
        <div className="stat card">
          <div className="stat-value">{pct(ai.categoryOverrideRate)}</div>
          <div className="stat-label">Category overridden by admins</div>
        </div>
        <div className="stat card">
          <div className="stat-value">{pct(ai.priorityOverrideRate)}</div>
          <div className="stat-label">Priority overridden by admins</div>
        </div>
        <div className="stat card">
          <div className="stat-value">
            {ai.repliesStartedFromAiDraft}/{ai.adminReplies}
          </div>
          <div className="stat-label">Replies started from AI draft</div>
        </div>
      </div>

      <div className="card table-wrap">
        <table className="queue">
          <thead>
            <tr>
              <th>Task</th>
              <th>Calls</th>
              <th>Failures</th>
              <th>Avg latency</th>
              <th>Input tokens</th>
              <th>Cached tokens</th>
              <th>Output tokens</th>
              <th>Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {ai.last30Days.map((r) => (
              <tr key={r.purpose}>
                <td>{PURPOSE_LABELS[r.purpose] ?? r.purpose}</td>
                <td>{r.calls}</td>
                <td>{r.failures}</td>
                <td>{r.avgLatencyMs ? `${(r.avgLatencyMs / 1000).toFixed(1)}s` : "—"}</td>
                <td>{r.inputTokens.toLocaleString()}</td>
                <td>{r.cacheReadTokens.toLocaleString()}</td>
                <td>{r.outputTokens.toLocaleString()}</td>
                <td>${r.estimatedCostUsd.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
