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
  OPENAI_API_KEY: z.string().optional(),
  // Classification and chat are short and frequent. Drafts are cached per
  // ticket, so the same inexpensive model is enough for all three.
  AI_CLASSIFY_MODEL: z.string().default("gpt-4o-mini"),
  AI_CHAT_MODEL: z.string().default("gpt-4o-mini"),
  AI_DRAFT_MODEL: z.string().default("gpt-4o-mini"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
