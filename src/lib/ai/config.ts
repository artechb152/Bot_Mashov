/**
 * חונך+ AI layer — usage & cost limits (documented, not silent).
 *
 * Central place for the guardrails around a real-provider call: request timeout,
 * per-task output ceilings, and input/context caps. When a limit is exceeded the
 * provider returns a CLEAR error (never a silent truncation of feedback) — see
 * `openai-provider.ts`. Pure data.
 */
import type { AITask } from "./types";

export const AI_LIMITS = {
  /** Hard timeout for a single provider call. */
  requestTimeoutMs: 60_000,
  /** SDK-level automatic retries (network/5xx/429 with backoff). */
  maxRetries: 2,
  /** Max length of a single user chat message (chars). Beyond → input_too_large. */
  maxUserMessageChars: 6_000,
  /** Max prior turns fed back as chat history (older turns are dropped from the
   *  PROMPT only — never from storage; the full conversation is always persisted). */
  maxHistoryTurns: 20,
  /** Max number of selected feedback items sent as sources. Beyond → context_too_large. */
  maxFeedbackItems: 300,
  /** Safety ceiling on the assembled prompt (chars). Beyond → context_too_large. */
  maxContextChars: 200_000,
  /** Max length of the document text sent for import extraction. Beyond → input_too_large. */
  maxExtractionChars: 60_000,
  /** Per-task output token ceiling. */
  maxOutputTokens: {
    chat: 1_200,
    feedback_polish: 1_400,
    feedback_summary: 1_400,
    trainee_review: 2_000,
    development_timeline: 2_000,
    next_focus: 1_200,
    final_evaluation: 2_600,
    // The aggregated review carries every section in one call → a larger ceiling.
    trainee_overview: 4_000,
    trainee_file_extract: 1_600,
  } satisfies Record<AITask, number>,
} as const;
