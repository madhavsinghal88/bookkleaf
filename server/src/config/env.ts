import "dotenv/config";
import { z } from "zod";

// All configuration comes from environment variables and is validated once at
// startup, so a missing secret fails fast instead of surfacing mid-request.
// The AI key is optional on purpose: without it the app still runs and falls
// back to rule-based classification and manual responses.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Classification is short and high-volume: a small, fast model is enough.
  AI_CLASSIFY_MODEL: z.string().default("claude-haiku-5-5"),
  // Drafts are read by authors, so writing quality matters more than cost;
  // each draft is generated once per ticket state and cached.
  AI_DRAFT_MODEL: z.string().default("claude-opus-5-5"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
