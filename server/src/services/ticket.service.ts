import { waitUntil } from "@vercel/functions";
import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import type { AuthUser } from "../middleware/auth.js";
import type {
  MessageKind,
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../generated/prisma/client.js";
import { classifyTicket } from "./ai/classifier.js";
import { draftReply, type ConversationMessage } from "./ai/drafter.js";

const ACTIVE_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS"];

// ---------------------------------------------------------------- create

export async function createTicket(
  user: AuthUser,
  input: { bookId: string | null; subject: string; description: string; attachmentName?: string | null },
) {
  if (input.bookId) {
    const book = await prisma.book.findUnique({ where: { id: input.bookId }, select: { authorId: true } });
    if (!book || book.authorId !== user.authorId) throw badRequest("Selected book does not belong to your account");
  }

  const ticket = await prisma.ticket.create({
    data: {
      authorId: user.authorId!,
      bookId: input.bookId,
      subject: input.subject,
      description: input.description,
      attachmentName: input.attachmentName ?? null,
    },
  });

  // The ticket is saved and returned immediately; classification runs after
  // the response. waitUntil keeps the serverless function alive until it's done.
  runInBackground(applyClassification(ticket.id));
  return ticket;
}

// ---------------------------------------------------------------- classification

const inFlight = new Set<number>();

function runInBackground(task: Promise<unknown>) {
  waitUntil(task.catch((err) => console.error("Background task failed:", err)));
}

// Classifies a ticket and stores the result, without overwriting anything an
// admin has already set by hand.
export async function applyClassification(ticketId: number, opts: { force?: boolean } = {}) {
  if (inFlight.has(ticketId)) return;
  inFlight.add(ticketId);
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { author: { include: { books: true } } },
    });
    if (!ticket || (ticket.classifiedAt && !opts.force)) return;

    const result = await classifyTicket({
      ticketId,
      subject: ticket.subject,
      description: ticket.description,
      authorName: ticket.author.name,
      books: ticket.author.books,
      bookId: ticket.bookId,
    });

    const data: Prisma.TicketUpdateInput = { aiSummary: result.summary, classifiedAt: new Date() };
    if (ticket.categorySource !== "ADMIN") {
      data.category = result.category;
      data.categorySource = result.source;
    }
    if (ticket.prioritySource !== "ADMIN") {
      data.priority = result.priority;
      data.prioritySource = result.source;
    }
    await prisma.ticket.update({ where: { id: ticketId }, data });
  } finally {
    inFlight.delete(ticketId);
  }
}

// Safety net for tickets whose background classification never finished
// (instance recycled mid-call, or seeded data). Called when admins load the
// queue, so it needs no scheduler.
async function classifyStragglers() {
  const stale = await prisma.ticket.findMany({
    where: { classifiedAt: null, createdAt: { lt: new Date(Date.now() - 30_000) } },
    select: { id: true },
    take: 5,
  });
  for (const { id } of stale) runInBackground(applyClassification(id));
}

// ---------------------------------------------------------------- list

export interface TicketFilters {
  status?: TicketStatus[];
  category?: TicketCategory;
  priority?: TicketPriority;
  assignee?: "me" | "unassigned";
  authorId?: string;
  bookId?: string;
  from?: Date;
  to?: Date;
  q?: string;
  sort: "urgency" | "newest" | "oldest" | "updated";
  page: number;
  pageSize: number;
}

const listSelect = {
  id: true,
  subject: true,
  status: true,
  category: true,
  categorySource: true,
  priority: true,
  prioritySource: true,
  aiSummary: true,
  createdAt: true,
  updatedAt: true,
  firstResponseAt: true,
  book: { select: { id: true, title: true } },
  author: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  _count: { select: { messages: { where: { kind: "REPLY" as MessageKind } } } },
} satisfies Prisma.TicketSelect;

// "urgency": Postgres sorts enums in declaration order, so CRITICAL comes
// first. Unclassified tickets (seconds old) sort to the top so nothing urgent
// is hidden while the AI runs. Within a priority, the oldest ticket comes first.
const SORT_ORDERS: Record<TicketFilters["sort"], Prisma.TicketOrderByWithRelationInput[]> = {
  urgency: [{ priority: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
  newest: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  updated: [{ updatedAt: "desc" }],
};

export async function listTickets(user: AuthUser, f: TicketFilters) {
  const where: Prisma.TicketWhereInput = {};

  if (user.role === "AUTHOR") {
    where.authorId = user.authorId!;
  } else {
    where.status = { in: f.status?.length ? f.status : ACTIVE_STATUSES };
    if (f.authorId) where.authorId = f.authorId;
    if (f.assignee === "me") where.assigneeId = user.id;
    if (f.assignee === "unassigned") where.assigneeId = null;
    runInBackground(classifyStragglers());
  }
  if (user.role === "AUTHOR" && f.status?.length) where.status = { in: f.status };
  if (f.category) where.category = f.category;
  if (f.priority) where.priority = f.priority;
  if (f.bookId) where.bookId = f.bookId;
  if (f.from || f.to) where.createdAt = { gte: f.from, lte: f.to };
  if (f.q) where.subject = { contains: f.q, mode: "insensitive" };

  const orderBy = SORT_ORDERS[f.sort];

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy,
      select: listSelect,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    items: items.map(({ _count, ...t }) => ({ ...t, replyCount: _count.messages })),
    total,
    page: f.page,
    pageSize: f.pageSize,
  };
}

// ---------------------------------------------------------------- detail

async function loadTicketFor(user: AuthUser, id: number) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  // Authors get a 404 (not 403) for other authors' tickets, so ids can't be probed.
  if (!ticket || (user.role === "AUTHOR" && ticket.authorId !== user.authorId)) throw notFound("Ticket");
  return ticket;
}

export async function getTicket(user: AuthUser, id: number) {
  const isAdmin = user.role === "ADMIN";

  // One query (this endpoint is polled), with the ownership check done on the result.
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      book: true,
      author: { select: { id: true, name: true, email: true, city: true } },
      assignee: { select: { id: true, name: true } },
      messages: {
        // Internal notes are filtered in the query itself, so they can never
        // leak into an author response by mistake.
        where: isAdmin ? undefined : { kind: "REPLY" },
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true, role: true } } },
      },
    },
  });
  if (!ticket || (!isAdmin && ticket.authorId !== user.authorId)) throw notFound("Ticket");

  if (isAdmin) return ticket;

  // Authors don't see internal triage data (priority, AI summary, assignee).
  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    category: ticket.category,
    attachmentName: ticket.attachmentName,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    firstResponseAt: ticket.firstResponseAt,
    resolvedAt: ticket.resolvedAt,
    book: ticket.book,
    messages: ticket.messages,
  };
}

// ---------------------------------------------------------------- admin updates

export async function updateTicket(
  admin: AuthUser,
  id: number,
  input: {
    status?: TicketStatus;
    category?: TicketCategory;
    priority?: TicketPriority;
    assigneeId?: string | null;
  },
) {
  const ticket = await loadTicketFor(admin, id);
  const data: Prisma.TicketUncheckedUpdateInput = {};

  if (input.status && input.status !== ticket.status) {
    data.status = input.status;
    data.resolvedAt = input.status === "RESOLVED" || input.status === "CLOSED" ? new Date() : null;
  }
  // Manual overrides are tagged ADMIN so re-classification never undoes them.
  if (input.category) {
    data.category = input.category;
    data.categorySource = "ADMIN";
  }
  if (input.priority) {
    data.priority = input.priority;
    data.prioritySource = "ADMIN";
  }
  if (input.assigneeId !== undefined) {
    if (input.assigneeId) {
      const assignee = await prisma.user.findUnique({ where: { id: input.assigneeId }, select: { role: true } });
      if (assignee?.role !== "ADMIN") throw badRequest("Tickets can only be assigned to BookLeaf team members");
    }
    data.assigneeId = input.assigneeId;
  }

  await prisma.ticket.update({ where: { id }, data });
  return getTicket(admin, id);
}

// ---------------------------------------------------------------- messages

export async function addMessage(
  user: AuthUser,
  id: number,
  input: { body: string; kind: MessageKind; status?: TicketStatus; fromAiDraft?: boolean },
) {
  const ticket = await loadTicketFor(user, id);
  const isAdmin = user.role === "ADMIN";

  if (!isAdmin && input.kind !== "REPLY") throw badRequest("Authors can only post replies");
  if (!isAdmin && ticket.status === "CLOSED") {
    throw conflict("This ticket is closed. Please raise a new ticket if you need more help.");
  }

  const ticketUpdate: Prisma.TicketUncheckedUpdateInput = { updatedAt: new Date() };

  if (isAdmin && input.kind === "REPLY") {
    if (!ticket.firstResponseAt) ticketUpdate.firstResponseAt = new Date();
    // Replying claims an unassigned ticket, and moves it out of "Open".
    if (!ticket.assigneeId) ticketUpdate.assigneeId = user.id;
    const nextStatus = input.status ?? (ticket.status === "OPEN" ? "IN_PROGRESS" : undefined);
    if (nextStatus && nextStatus !== ticket.status) {
      ticketUpdate.status = nextStatus;
      ticketUpdate.resolvedAt = nextStatus === "RESOLVED" || nextStatus === "CLOSED" ? new Date() : null;
    }
  } else if (!isAdmin && ticket.status === "RESOLVED") {
    // An author replying to a resolved ticket reopens it.
    ticketUpdate.status = "OPEN";
    ticketUpdate.resolvedAt = null;
  }

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: user.id,
        kind: input.kind,
        body: input.body,
        fromAiDraft: isAdmin && input.kind === "REPLY" && Boolean(input.fromAiDraft),
      },
    }),
    prisma.ticket.update({ where: { id }, data: ticketUpdate }),
  ]);

  return getTicket(user, id);
}

// ---------------------------------------------------------------- AI draft

// Returns the cached draft if the conversation hasn't changed since it was
// generated; otherwise (or when forced) generates a new one.
export async function getDraft(admin: AuthUser, id: number, opts: { regenerate?: boolean } = {}) {
  await loadTicketFor(admin, id);
  const ticket = await prisma.ticket.findUniqueOrThrow({
    where: { id },
    include: {
      aiDraft: true,
      author: { include: { books: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { role: true } } } },
    },
  });

  // Cache key: number of replies. Internal notes don't invalidate the draft
  // (the admin can press "Regenerate" to fold a new note in).
  const messageCount = ticket.messages.filter((m) => m.kind === "REPLY").length;
  if (ticket.aiDraft && ticket.aiDraft.messageCount === messageCount && !opts.regenerate) {
    return { ...ticket.aiDraft, source: "AI" as const, cached: true };
  }

  const conversation: ConversationMessage[] = ticket.messages.map((m) => ({
    from: m.kind === "INTERNAL_NOTE" ? "INTERNAL_NOTE" : m.sender.role === "ADMIN" ? "BOOKLEAF" : "AUTHOR",
    body: m.body,
  }));

  const draft = await draftReply({
    ticketId: id,
    category: ticket.category ?? "GENERAL_INQUIRY",
    subject: ticket.subject,
    description: ticket.description,
    authorName: ticket.author.name,
    books: ticket.author.books,
    bookId: ticket.bookId,
    conversation,
  });

  if (draft.source === "TEMPLATE") {
    return { ticketId: id, content: draft.reply, checklist: draft.checklist, model: draft.model, source: draft.source, cached: false, createdAt: new Date(), messageCount };
  }

  const saved = await prisma.aiDraft.upsert({
    where: { ticketId: id },
    create: { ticketId: id, content: draft.reply, checklist: draft.checklist, model: draft.model, messageCount },
    update: { content: draft.reply, checklist: draft.checklist, model: draft.model, messageCount, createdAt: new Date() },
  });
  return { ...saved, source: "AI" as const, cached: false };
}
