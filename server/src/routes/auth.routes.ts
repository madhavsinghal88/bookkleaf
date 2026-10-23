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

const ProfileBody = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  phone: z.string().trim().max(30, "Phone is too long").optional(),
  city: z.string().trim().max(60, "City is too long").optional(),
  language: z.enum(["en", "hi"], { error: "Choose English or Hindi" }),
});

// GET /api/auth/me -> current user's profile
authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await authService.getProfile(currentUser(req).id));
});

// PATCH /api/auth/me -> update name, contact details, and portal language
authRouter.patch("/me", requireAuth, async (req, res) => {
  const body = parse(ProfileBody, req.body);
  res.json(await authService.updateProfile(currentUser(req), body));
});
