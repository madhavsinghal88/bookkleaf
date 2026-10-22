import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { forbidden, unauthorized } from "../lib/errors.js";
import type { Role } from "../generated/prisma/client.js";

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
  // Only set for authors; every author-scoped query filters on it.
  authorId: string | null;
}

interface TokenPayload {
  sub: string;
  name: string;
  role: Role;
  authorId: string | null;
}

const TOKEN_TTL = "8h";

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    name: user.name,
    role: user.role,
    authorId: user.authorId,
  };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Verifies the Bearer token and attaches the user to the request. The token is
// self-contained, so no database lookup is needed per request.
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();

  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload;
    req.user = {
      id: payload.sub,
      name: payload.name,
      role: payload.role,
      authorId: payload.authorId,
    };
  } catch {
    throw unauthorized("Session expired or invalid. Please log in again.");
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

// For handlers mounted behind requireAuth.
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
