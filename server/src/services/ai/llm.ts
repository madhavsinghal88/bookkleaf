// Thin wrapper around the OpenAI SDK that every AI feature goes through.
// Responsibilities: key handling, timeouts/retries, a small circuit breaker,
// and logging every call (tokens, latency, errors) to AiCallLog for cost tracking.
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import type { AiPurpose } from "../../generated/prisma/client.js";

// The key is read from the environment on the server only; it is never sent
// to the browser. No key means AI is disabled and callers use their fallbacks.
const apiKey = env.OPENAI_API_KEY?.trim() || undefined;
const client = apiKey
  ? new OpenAI({
      apiKey,
      timeout: 25_000, // ms; keeps us inside the serverless function limit
      maxRetries: 2, // SDK retries 408/409/429/5xx with exponential backoff
    })
  : null;

export const models = {
  classify: env.AI_CLASSIFY_MODEL,
  draft: env.AI_DRAFT_MODEL,
  chat: env.AI_CHAT_MODEL,
};

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

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
  if (!client) return { enabled: false, reason: "OPENAI_API_KEY is not configured" };
  if (Date.now() < openUntil) {
    return { enabled: false, reason: "AI provider temporarily unavailable; retrying shortly" };
  }
  return { enabled: true, reason: null };
}

function tripsBreaker(err: unknown): boolean {
  return (
    err instanceof OpenAI.RateLimitError ||
    err instanceof OpenAI.InternalServerError ||
    err instanceof OpenAI.APIConnectionError // includes timeouts
  );
}

// One structured completion. The static system text stays at the front of the
// request so OpenAI can cache that prefix automatically on repeat calls.
export async function completeStructured<T extends z.ZodType>(
  meta: { purpose: AiPurpose; model: string; ticketId?: number },
  input: {
    schema: T;
    name: string;
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
    maxTokens: number;
  },
): Promise<z.infer<T>> {
  return callAi(meta, async (openai) => {
    const response = await openai.chat.completions.parse({
      model: meta.model,
      max_completion_tokens: input.maxTokens,
      messages: [{ role: "system", content: input.system }, ...input.messages],
      response_format: zodResponseFormat(input.schema, input.name),
    });
    const message = response.choices[0]?.message;
    if (!message?.parsed) {
      throw new Error(message?.refusal || "Model returned no structured output");
    }
    const cached = response.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    const promptTokens = response.usage?.prompt_tokens ?? 0;
    return {
      result: message.parsed as z.infer<T>,
      usage: {
        inputTokens: Math.max(0, promptTokens - cached),
        outputTokens: response.usage?.completion_tokens ?? 0,
        cacheReadTokens: cached,
        cacheCreationTokens: 0,
      },
    };
  });
}

// Runs one AI call with logging. Any failure is logged and rethrown as
// AiUnavailableError so callers can fall back without inspecting SDK errors.
async function callAi<T>(
  meta: { purpose: AiPurpose; model: string; ticketId?: number },
  fn: (client: OpenAI) => Promise<{ result: T; usage: TokenUsage }>,
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
  outcome: { usage?: TokenUsage; error?: string },
) {
  try {
    await prisma.aiCallLog.create({
      data: {
        ticketId: meta.ticketId,
        purpose: meta.purpose,
        model: meta.model,
        success: !outcome.error,
        errorMessage: outcome.error?.slice(0, 500),
        inputTokens: outcome.usage?.inputTokens,
        outputTokens: outcome.usage?.outputTokens,
        cacheReadTokens: outcome.usage?.cacheReadTokens,
        cacheCreationTokens: outcome.usage?.cacheCreationTokens,
        latencyMs: Date.now() - started,
      },
    });
  } catch (err) {
    // Logging must never break the feature it is measuring.
    console.error("Failed to record AI call:", err);
  }
}

// USD per million tokens, used for the cost estimate on the admin dashboard.
// Cached prompt tokens are billed at half the input price for these models.
const PRICING: Record<string, { input: number; output: number; cacheRead: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6, cacheRead: 0.075 },
  "gpt-4o": { input: 2.5, output: 10, cacheRead: 1.25 },
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
    (row.cacheReadTokens ?? 0) * perToken(price.cacheRead) +
    (row.outputTokens ?? 0) * perToken(price.output)
  );
}
