import { z } from "zod";
import { AppError } from "./errors.js";

// Parses untrusted input (body, query, params) against a schema. On failure it
// throws a 400 listing every invalid field, so clients can show inline errors.
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      result.error.issues.map((issue) => ({
        field: issue.path.join(".") || null,
        message: issue.message,
      })),
    );
  }
  return result.data;
}

// Route param `:id` for tickets is a positive integer.
export const ticketIdParam = z.object({ id: z.coerce.number().int().positive() });
