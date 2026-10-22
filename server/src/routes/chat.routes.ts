import { Router } from "express";
import { z } from "zod";
import { parse } from "../lib/validate.js";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import * as chatService from "../services/chat.service.js";

const SessionQuery = z.object({
  sessionId: z.uuid("sessionId must be a UUID"),
});

const SalesBody = z.object({
  sessionId: z.uuid("sessionId must be a UUID"),
  message: z.string().trim().min(1, "Type a message").max(1500, "Message must be 1,500 characters or fewer"),
});

const SupportBody = z.object({
  message: z.string().trim().min(1, "Type a message").max(1500, "Message must be 1,500 characters or fewer"),
});

export const chatRouter = Router();

// Public. The session id is an unguessable browser id, not an account.
chatRouter.get("/sales", async (req, res) => {
  const query = parse(SessionQuery, req.query);
  res.json(await chatService.listSales(query.sessionId));
});

chatRouter.post("/sales", async (req, res) => {
  const body = parse(SalesBody, req.body);
  res.status(201).json(await chatService.sendSales(body.sessionId, body.message));
});

chatRouter.get("/support", requireAuth, requireRole("AUTHOR"), async (req, res) => {
  res.json(await chatService.listSupport(currentUser(req)));
});

chatRouter.post("/support", requireAuth, requireRole("AUTHOR"), async (req, res) => {
  const body = parse(SupportBody, req.body);
  res.status(201).json(await chatService.sendSupport(currentUser(req), body.message));
});
