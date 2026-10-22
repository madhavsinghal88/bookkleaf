import { Router } from "express";
import { z } from "zod";
import { parse } from "../lib/validate.js";
import { currentUser, requireAuth } from "../middleware/auth.js";
import * as authService from "../services/auth.service.js";

const LoginBody = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export const authRouter = Router();

// POST /api/auth/login -> { token, user }
authRouter.post("/login", async (req, res) => {
  const { email, password } = parse(LoginBody, req.body);
  res.json(await authService.login(email, password));
});

// GET /api/auth/me -> current user's profile
authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await authService.getProfile(currentUser(req).id));
});
