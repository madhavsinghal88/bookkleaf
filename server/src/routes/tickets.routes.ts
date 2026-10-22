import { Router } from "express";
import { z } from "zod";
import { parse, ticketIdParam } from "../lib/validate.js";
import { currentUser, requireRole } from "../middleware/auth.js";
import * as ticketService from "../services/ticket.service.js";
import { aiStatus } from "../services/ai/llm.js";

const Status = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const Category = z.enum([
  "ROYALTY_PAYMENTS",
  "ISBN_METADATA",
  "PRINTING_QUALITY",
  "DISTRIBUTION_AVAILABILITY",
  "BOOK_STATUS_PRODUCTION",
  "GENERAL_INQUIRY",
]);
const Priority = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

const ListQuery = z.object({
  // ?status=OPEN,IN_PROGRESS  (comma-separated)
  status: z
    .string()
    .transform((s) => s.split(",").filter(Boolean))
    .pipe(z.array(Status))
    .optional(),
  category: Category.optional(),
  priority: Priority.optional(),
  assignee: z.enum(["me", "unassigned"]).optional(),
  authorId: z.string().optional(),
  bookId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["urgency", "newest", "oldest", "updated"]).default("urgency"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const CreateBody = z.object({
  bookId: z.string().nullable().default(null), // null = "General / Account Level"
  subject: z.string().trim().min(5, "Subject must be at least 5 characters").max(150),
  description: z.string().trim().min(20, "Please describe the issue in at least 20 characters").max(5000),
  attachmentName: z.string().trim().max(255).nullable().optional(),
});

const UpdateBody = z
  .object({
    status: Status.optional(),
    category: Category.optional(),
    priority: Priority.optional(),
    // "me" is a convenience for "assign to myself"; null unassigns.
    assigneeId: z.string().nullable().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Provide at least one field to update");

const MessageBody = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(10000),
  kind: z.enum(["REPLY", "INTERNAL_NOTE"]).default("REPLY"),
  // Admin only: set the ticket status in the same action, e.g. "send & resolve".
  status: Status.optional(),
  fromAiDraft: z.boolean().optional(),
});

export const ticketsRouter = Router();

// GET /api/tickets: author sees own tickets; admin sees the queue with filters.
ticketsRouter.get("/", async (req, res) => {
  const filters = parse(ListQuery, req.query);
  res.json(await ticketService.listTickets(currentUser(req), filters));
});

// POST /api/tickets: authors raise a ticket. Returns 201 immediately;
// AI classification happens in the background.
ticketsRouter.post("/", requireRole("AUTHOR"), async (req, res) => {
  const body = parse(CreateBody, req.body);
  const ticket = await ticketService.createTicket(currentUser(req), body);
  res.status(201).location(`/api/tickets/${ticket.id}`).json(ticket);
});

// GET /api/tickets/:id: polled by both portals for near-real-time updates.
// Express sends an ETag, so unchanged polls get a cheap 304.
ticketsRouter.get("/:id", async (req, res) => {
  const { id } = parse(ticketIdParam, req.params);
  res.json(await ticketService.getTicket(currentUser(req), id));
});

// PATCH /api/tickets/:id: admin changes status/category/priority/assignee.
ticketsRouter.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const { id } = parse(ticketIdParam, req.params);
  const user = currentUser(req);
  const body = parse(UpdateBody, req.body);
  if (body.assigneeId === "me") body.assigneeId = user.id;
  res.json(await ticketService.updateTicket(user, id, body));
});

// POST /api/tickets/:id/messages: author reply, admin reply, or internal note.
ticketsRouter.post("/:id/messages", async (req, res) => {
  const { id } = parse(ticketIdParam, req.params);
  const body = parse(MessageBody, req.body);
  res.status(201).json(await ticketService.addMessage(currentUser(req), id, body));
});

// GET /api/tickets/:id/draft: AI-drafted reply (cached per conversation state).
ticketsRouter.get("/:id/draft", requireRole("ADMIN"), async (req, res) => {
  const { id } = parse(ticketIdParam, req.params);
  res.json({ ...(await ticketService.getDraft(currentUser(req), id)), ai: aiStatus() });
});

// POST /api/tickets/:id/draft: force a fresh draft.
ticketsRouter.post("/:id/draft", requireRole("ADMIN"), async (req, res) => {
  const { id } = parse(ticketIdParam, req.params);
  res.json({ ...(await ticketService.getDraft(currentUser(req), id, { regenerate: true })), ai: aiStatus() });
});

// POST /api/tickets/:id/classify: re-run AI classification (admin overrides are kept).
ticketsRouter.post("/:id/classify", requireRole("ADMIN"), async (req, res) => {
  const { id } = parse(ticketIdParam, req.params);
  await ticketService.applyClassification(id, { force: true });
  res.json(await ticketService.getTicket(currentUser(req), id));
});
