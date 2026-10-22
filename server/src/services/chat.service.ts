// Sales chat is public and tied to a browser session id. Support chat is tied
// to the signed-in author and only ever loads that author's books.
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "../middleware/auth.js";
import type { ChatMessage, ChatRole } from "../generated/prisma/client.js";
import { salesChatReply, supportChatReply, type ChatTurn } from "./ai/chat.js";

const MESSAGE_WINDOW_MS = 10 * 60 * 1000;
const MESSAGE_LIMIT = 20;
const buckets = new Map<string, number[]>();

function rateLimit(key: string) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((at) => now - at < MESSAGE_WINDOW_MS);
  if (hits.length >= MESSAGE_LIMIT) {
    throw new AppError(429, "RATE_LIMITED", "Too many messages. Please wait a few minutes and try again.");
  }
  hits.push(now);
  buckets.set(key, hits);
}

function present(message: ChatMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    source: message.source,
    createdAt: message.createdAt.toISOString(),
  };
}

function turns(messages: { role: ChatRole; content: string }[]): ChatTurn[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export async function listSales(sessionId: string) {
  const thread = await prisma.chatThread.findUnique({
    where: { sessionId_kind: { sessionId, kind: "SALES" } },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  return { messages: thread?.messages.map(present) ?? [] };
}

async function recentTurns(threadId: string): Promise<ChatTurn[]> {
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 8,
  });
  return turns(messages.reverse());
}

function pair(message: string, reply: { reply: string; source: "AI" | "RULES" }) {
  const askedAt = new Date();
  return [
    { role: "USER" as const, content: message, createdAt: askedAt },
    {
      role: "ASSISTANT" as const,
      content: reply.reply,
      source: reply.source,
      createdAt: new Date(askedAt.getTime() + 1),
    },
  ];
}

export async function sendSales(sessionId: string, message: string) {
  rateLimit(`sales:${sessionId}`);
  const thread = await prisma.chatThread.upsert({
    where: { sessionId_kind: { sessionId, kind: "SALES" } },
    create: { kind: "SALES", sessionId },
    update: {},
  });
  const reply = await salesChatReply(await recentTurns(thread.id), message);
  const saved = await prisma.chatThread.update({
    where: { id: thread.id },
    data: {
      messages: { create: pair(message, reply) },
    },
    include: { messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2 } },
  });
  return { messages: saved.messages.reverse().map(present) };
}

export async function listSupport(user: AuthUser) {
  if (user.role !== "AUTHOR" || !user.authorId) {
    throw new AppError(403, "FORBIDDEN", "The author assistant is only available to authors.");
  }
  const thread = await prisma.chatThread.findUnique({
    where: { userId_kind: { userId: user.id, kind: "SUPPORT" } },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  return { messages: thread?.messages.map(present) ?? [] };
}

export async function sendSupport(user: AuthUser, message: string) {
  if (user.role !== "AUTHOR" || !user.authorId) {
    throw new AppError(403, "FORBIDDEN", "The author assistant is only available to authors.");
  }
  rateLimit(`support:${user.id}`);
  const author = await prisma.author.findUnique({
    where: { id: user.authorId },
    include: { books: { orderBy: { title: "asc" } } },
  });
  if (!author) throw new AppError(404, "NOT_FOUND", "Author not found");

  const thread = await prisma.chatThread.upsert({
    where: { userId_kind: { userId: user.id, kind: "SUPPORT" } },
    create: { kind: "SUPPORT", userId: user.id },
    update: {},
  });
  const reply = await supportChatReply({
    history: await recentTurns(thread.id),
    message,
    authorName: author.name,
    books: author.books,
  });
  const saved = await prisma.chatThread.update({
    where: { id: thread.id },
    data: {
      messages: { create: pair(message, reply) },
    },
    include: { messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2 } },
  });
  return { messages: saved.messages.reverse().map(present) };
}
