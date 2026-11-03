/**
 * חונך+ AI layer — factory + service entry (Stage 0). **Server-only.**
 *
 * `getAIProvider()` chooses the implementation from env (dev Mock vs the default
 * Null Provider); a real provider is added here later as a one-line drop-in.
 * `runAITask()` is the single entry every route uses: it runs the provider and
 * re-validates the structured output (defense against a future real provider),
 * downgrading a malformed answer to a clean "error". It does NOT do authorization
 * or data access — the caller enforces `requireTraineeAccess` and passes an
 * already-authorized, selected-feedback-only {@link AIContext}.
 *
 * Note: this module (and `./context`, `./knowledge`) use Node built-ins and must
 * only be imported from server code. For AI *types* on the client, import
 * `@/lib/ai/types` (type-only).
 */
import { mockProvider } from "./mock-provider";
import { nullProvider } from "./null-provider";
import { createGeminiProvider } from "./gemini-provider";
import { createOpenAIProvider } from "./openai-provider";
import { validateTaskOutput } from "./schemas";
import type { AIProvider } from "./provider";
import type { AIContext, AIErrorCategory, AIResult, AITask, AITaskInput, AITaskOutput } from "./types";

/** The env-derived provider selection + reason (server-only; never exposes the key). */
export type AIStatusCategory =
  | "null"
  | "mock"
  | "openai"
  | "openai_missing_key"
  | "openai_missing_model"
  | "gemini"
  | "gemini_missing_key"
  | "gemini_missing_model"
  | "configuration_error";

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

/** A provider that fails every task with a fixed category (misconfiguration surfaces
 *  cleanly in the UI instead of throwing). */
function inertProvider(
  status: "not_configured" | "error",
  category: AIErrorCategory,
  message: string,
  name: "openai" | "gemini" = "openai",
): AIProvider {
  return {
    name,
    async run(task) {
      return status === "not_configured"
        ? { status: "not_configured", task, provider: name, message, category }
        : { status: "error", task, provider: name, message, category };
    },
  };
}

/** Classify the configured provider from env. Single source of truth for the factory
 *  AND the status endpoint, so they can never disagree. Never returns the key. */
export function resolveAIConfig(): {
  category: AIStatusCategory;
  provider: "null" | "mock" | "openai" | "gemini";
  model: string | null;
} {
  const configured = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  const model = (process.env.OPENAI_MODEL ?? "").trim() || null;
  const hasKey = Boolean((process.env.OPENAI_API_KEY ?? "").trim());

  const geminiModel = (process.env.GEMINI_MODEL ?? "").trim() || null;
  const hasGeminiKey = Boolean((process.env.GEMINI_API_KEY ?? "").trim());

  switch (configured) {
    case "gemini":
      if (!hasGeminiKey) return { category: "gemini_missing_key", provider: "gemini", model: geminiModel };
      if (!geminiModel) return { category: "gemini_missing_model", provider: "gemini", model: null };
      return { category: "gemini", provider: "gemini", model: geminiModel };
    case "mock":
      // Mock is DEVELOPMENT-only; in production it is downgraded to Null.
      return { category: isProd() ? "null" : "mock", provider: isProd() ? "null" : "mock", model };
    case "openai":
      if (!hasKey) return { category: "openai_missing_key", provider: "openai", model };
      if (!model) return { category: "openai_missing_model", provider: "openai", model: null };
      return { category: "openai", provider: "openai", model };
    case "":
    case "null":
      return { category: "null", provider: "null", model };
    default:
      // Unknown value → safe Null (a clear configuration category, never a crash).
      return { category: "configuration_error", provider: "null", model };
  }
}

/** Pick the provider from `AI_PROVIDER` env. Unknown/empty → Null (not configured). */
export function getAIProvider(): AIProvider {
  const cfg = resolveAIConfig();
  switch (cfg.category) {
    case "mock":
      return mockProvider;
    case "openai":
      return createOpenAIProvider({
        apiKey: (process.env.OPENAI_API_KEY ?? "").trim(),
        model: cfg.model as string,
      });
    case "gemini":
      return createGeminiProvider({
        apiKey: (process.env.GEMINI_API_KEY ?? "").trim(),
        model: cfg.model as string,
      });
    case "gemini_missing_key":
      return inertProvider("not_configured", "not_configured", "לא הוגדר מפתח API לספק ה-AI.", "gemini");
    case "gemini_missing_model":
      return inertProvider("error", "configuration_error", "לא הוגדר מודל (GEMINI_MODEL) לספק ה-AI.", "gemini");
    case "openai_missing_key":
      return inertProvider("not_configured", "not_configured", "לא הוגדר מפתח API לספק ה-AI.");
    case "openai_missing_model":
      return inertProvider("error", "configuration_error", "לא הוגדר מודל (OPENAI_MODEL) לספק ה-AI.");
    case "configuration_error":
    case "null":
    default:
      return nullProvider;
  }
}

/**
 * Non-secret provider status for the UI (server-only). `configured` is true only when
 * a provider can actually produce results (mock in dev, or a fully-configured OpenAI).
 * `mock` is true only in development with `AI_PROVIDER=mock`. NEVER returns the API
 * key (or any part of it), headers, or internal config.
 */
export function getAIStatus(): {
  configured: boolean;
  mock: boolean;
  provider: "null" | "mock" | "openai" | "gemini";
  category: AIStatusCategory;
} {
  const cfg = resolveAIConfig();
  return {
    configured: cfg.category === "mock" || cfg.category === "openai" || cfg.category === "gemini",
    mock: cfg.category === "mock",
    provider: cfg.provider,
    category: cfg.category,
  };
}

/**
 * Run one AI task against the configured provider and validate the result. The
 * caller must have already authorized the trainee and built `context` from the
 * SELECTED, authorized feedback only.
 */
export async function runAITask<T extends AITask>(
  task: T,
  input: AITaskInput<T>,
  context: AIContext,
): Promise<AIResult<AITaskOutput<T>>> {
  const provider = getAIProvider();
  const result = await provider.run(task, input, context);

  if (result.status === "ok") {
    const errors = validateTaskOutput(task, result.output);
    if (errors.length > 0) {
      return {
        status: "error",
        task,
        provider: provider.name,
        message: `פלט לא תקין מהספק (${provider.name}): ${errors.join("; ")}`,
        category: "invalid_output",
      };
    }
  }
  return result;
}

export { defineStructuredProvider } from "./provider";
export type { AIProvider, TaskHandlers } from "./provider";
export {
  buildTraineeAIContext,
  selectFeedbackForContext,
  computeContextHash,
  versionOf,
  type FeedbackSelection,
} from "./context";
export { validateTaskOutput, isValidTaskOutput, type Validation } from "./schemas";
export * from "./types";
