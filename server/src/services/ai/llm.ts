// Thin wrapper around the Anthropic SDK that every AI feature goes through.
// Responsibilities: key handling, timeouts/retries, a small circuit breaker,
// and logging every call (tokens, latency, errors) to AiCallLog for cost tracking.
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import type { AiPurpose } from "../../generated/prisma/client.js";

// The key is read from the environment on the server only; it is never sent
// to the browser. No key means AI is disabled and callers use their fallbacks.
const client = env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      timeout: 25_000, // ms; keeps us inside the serverless function limit
      maxRetries: 2, // SDK retries 408/409/429/5xx with exponential backoff
    })
  : null;

export const models = {
  classify: env.AI_CLASSIFY_MODEL,
  draft: env.AI_DRAFT_MODEL,
};

// Circuit breaker: after a provider-side failure (rate limit, outage, timeout)
// skip AI calls for a short cool-down instead of making every request wait for
// retries to time out. State is per server instance, which is fine for this purpose.
const COOL_DOWN_MS = 60_000;
let openUntil = 0;

export class AiUnavailableError extends Error {}

export function aiAvailable(): boolean {
  return client !== null && Date.now() >= openUntil;
}

export function aiStatus() {
  if (!client) return { enabled: false, reason: "ANTHROPIC_API_KEY is not configured" };
  if (Date.now() < openUntil) {
    return { enabled: false, reason: "AI provider temporarily unavailable; retrying shortly" };
  }
  return { enabled: true, reason: null };
}

function tripsBreaker(err: unknown): boolean {
  return (
    err instanceof Anthropic.RateLimitError ||
    err instanceof Anthropic.InternalServerError ||
    err instanceof Anthropic.APIConnectionError // includes timeouts
  );
}

// Runs one AI call with logging. `fn` receives the client; the returned usage
// is recorded. Any failure is logged and rethrown as AiUnavailableError so
// callers can fall back without inspecting SDK error types.
export async function callAi<T>(
  meta: { purpose: AiPurpose; model: string; ticketId?: number },
  fn: (client: Anthropic) => Promise<{ result: T; usage: Anthropic.Usage }>,
): Promise<T> {
  if (!client) throw new AiUnavailableError("AI disabled: no API key");
  if (Date.now() < openUntil) throw new AiUnavailableError("AI circuit open");

  const started = Date.now();
  try {
    const { result, usage } = await fn(client);
    await logCall(meta, started, { usage });
    return result;
  } catch (err) {
    if (tripsBreaker(err)) openUntil = Date.now() + COOL_DOWN_MS;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`AI ${meta.purpose} failed:`, message);
    await logCall(meta, started, { error: message });
    throw new AiUnavailableError(message);
  }
}

async function logCall(
  meta: { purpose: AiPurpose; model: string; ticketId?: number },
  started: number,
  outcome: { usage?: Anthropic.Usage; error?: string },
) {
  try {
    await prisma.aiCallLog.create({
      data: {
        ticketId: meta.ticketId,
        purpose: meta.purpose,
        model: meta.model,
        success: !outcome.error,
        errorMessage: outcome.error?.slice(0, 500),
        inputTokens: outcome.usage?.input_tokens,
        outputTokens: outcome.usage?.output_tokens,
        cacheReadTokens: outcome.usage?.cache_read_input_tokens ?? undefined,
        cacheCreationTokens: outcome.usage?.cache_creation_input_tokens ?? undefined,
        latencyMs: Date.now() - started,
      },
    });
  } catch (err) {
    // Logging must never break the feature it is measuring.
    console.error("Failed to record AI call:", err);
  }
}

// USD per million tokens, used for the cost estimate on the admin dashboard.
// Cache writes cost 1.25x input (5-minute TTL); cache reads are much cheaper.
const PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
};

export function estimateCostUsd(row: {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
}): number {
  const price = PRICING[row.model];
  if (!price) return 0;
  const perToken = (usd: number) => usd / 1_000_000;
  return (
    (row.inputTokens ?? 0) * perToken(price.input) +
    (row.cacheCreationTokens ?? 0) * perToken(price.input) * 1.25 +
    (row.cacheReadTokens ?? 0) * perToken(price.cacheRead) +
    (row.outputTokens ?? 0) * perToken(price.output)
  );
}
