import { Router } from "express";
import * as adminService from "../services/admin.service.js";

// Mounted behind requireAuth + requireRole("ADMIN") in app.ts.
export const adminRouter = Router();

// GET /api/admin/team: BookLeaf team members tickets can be assigned to.
adminRouter.get("/team", async (_req, res) => {
  res.json({ items: await adminService.listTeam() });
});

// GET /api/admin/stats: queue health and AI usage/cost for the last 30 days.
adminRouter.get("/stats", async (_req, res) => {
  res.json(await adminService.getStats());
});
