import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { Prisma } from "../generated/prisma/client.js";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.originalUrl.split("?")[0]}` },
  });
}

// Maps every error to a meaningful status and the same JSON shape. Unknown
// errors are logged in full but only a generic message reaches the client.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Malformed JSON body, raised by express.json().
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body is not valid JSON" } });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Record not found" } });
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json({ error: { code: "CONFLICT", message: "Record already exists" } });
      return;
    }
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." },
  });
}
