/**
 * חונך+ AI layer — shared types (Stage 0).
 *
 * Provider-agnostic contracts for the assistant/insights pipeline. NOTHING here
 * touches a real LLM, the DB, HTTP, or the DOM — it is pure TypeScript that both
 * the (future) real provider and the deterministic dev Mock Provider implement.
 *
 * Design rules:
 * - Task-typed IO: each task has a typed input and a typed **structured output**
 *   (see AITaskInputMap / AITaskOutputMap). Validation lives in `./schemas`.
 * - Every provider call returns an {@link AIResult} envelope that distinguishes a
 *   real "ok" output from "not_configured" (no provider wired) and "error" — so
 *   the UI can show "AI לא מחובר עדיין" and NEVER present a fake result as real.
 * - The provider is handed an already-authorized {@link AIContext}; it never
 *   fetches data. Authorization + selecting the feedback happen at the boundary
 *   (the HTTP route, later stages), so the AI layer cannot leak another user's or
 *   another trainee's data.
 */
import type { CourseType, FeedbackType } from "@/lib/domain/types";

/** The distinct AI task kinds the product needs. */
export const AI_TASKS = [
  "chat",
  "feedback_polish",
  "feedback_summary",
  "trainee_review",
  "development_timeline",
  "next_focus",
  "final_evaluation",
  "trainee_overview",
  "trainee_file_extract",
] as const;
export type AITask = (typeof AI_TASKS)[number];

export function isAITask(value: unknown): value is AITask {
  return typeof value === "string" && (AI_TASKS as readonly string[]).includes(value);
}

/** Which AI tasks persist a versioned, traceable artifact (see TraineeAIInsight). */
export const AI_ARTIFACT_TASKS = [
  "trainee_review",
  "development_timeline",
  "next_focus",
  "feedback_summary",
  "final_evaluation",
  "trainee_overview",
] as const;
export type AIArtifactTask = (typeof AI_ARTIFACT_TASKS)[number];

export function isAIArtifactTask(value: unknown): value is AIArtifactTask {
  return typeof value === "string" && (AI_ARTIFACT_TASKS as readonly string[]).includes(value);
}

/** A stored assistant turn's speaker (adds "system" beyond the chat user/assistant). */
export const ASSISTANT_TURN_ROLES = ["user", "assistant", "system"] as const;
export type AssistantTurnRole = (typeof ASSISTANT_TURN_ROLES)[number];

/** Per-trainee AI conversation lifecycle (soft archive; never hard-deleted in Stage 2). */
export const CONVERSATION_STATUSES = ["active", "archived"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/**
 * Versioned AI-artifact lifecycle:
 *   - current    — the latest artifact of its type for the trainee;
 *   - superseded — replaced by a newer artifact of the same type (kept for history);
 *   - stale      — its source feedback changed, so it may no longer be up to date.
 */
export const INSIGHT_STATUSES = ["current", "superseded", "stale"] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

/* --------------------------------------------------------------------------
 * Context — what the provider is allowed to see.
 * ------------------------------------------------------------------------ */

/** A single feedback entry as seen by the AI layer (plain DTO — never a Mongoose doc). */
export type AIFeedbackItem = {
  id: string;
  feedbackType: FeedbackType;
  rawText: string;
  selectedAction?: string;
  /** ISO timestamps — drive chronology and the staleness fingerprint. */
  createdAt: string;
  updatedAt?: string;
};

/** Non-sensitive trainee basics for grounding. Only fields the viewer may see. */
export type AITraineeContext = {
  id: string;
  fullName: string;
  courseType: CourseType;
  team?: string | null;
  cohortName?: string | null;
};

/**
 * The assembled, authorized context passed to a provider. `feedback` contains
 * ONLY the selected + authorized entries (see `buildTraineeAIContext`).
 */
export type AIContext = {
  /** System instructions (from src/lib/bot/system-prompt.md). */
  systemPrompt: string;
  /** Binding professional-knowledge excerpts loaded for EVERY task (doctrine, models,
   *  guardrails, templates). Never includes the per-task guides/examples. */
  knowledgeExcerpts: string[];
  /** OPTIONAL task-specific knowledge (guides/examples) loaded only for the current
   *  task (e.g. the final-evaluation guide + examples). Rendered in its own section,
   *  below the binding knowledge; treated as reference, never as system instructions. */
  taskKnowledge?: string[];
  /** Version fingerprints for traceability of derived artifacts. */
  systemPromptVersion: string;
  knowledgeVersion: string;
  trainee: AITraineeContext | null;
  feedback: AIFeedbackItem[];
  locale: "he";
};

/* --------------------------------------------------------------------------
 * Per-task inputs.
 * ------------------------------------------------------------------------ */

export type AIChatMessage = { role: "user" | "assistant"; content: string };

export type ChatInput = { messages: AIChatMessage[] };
export type FeedbackPolishInput = { rawText: string; feedbackType: FeedbackType; selectedAction?: string };
/** These tasks derive entirely from the context's selected feedback. */
export type FeedbackSummaryInput = Record<string, never>;
export type TraineeReviewInput = Record<string, never>;
export type DevelopmentTimelineInput = Record<string, never>;
export type NextFocusInput = Record<string, never>;
export type FinalEvaluationInput = Record<string, never>;
export type TraineeOverviewInput = Record<string, never>;
/** Import extraction runs on plain document text, NOT on the feedback context. The
 *  binary is never sent — only the server-extracted text (see extract-text.ts). */
export type TraineeFileExtractInput = { text: string };

export type AITaskInputMap = {
  chat: ChatInput;
  feedback_polish: FeedbackPolishInput;
  feedback_summary: FeedbackSummaryInput;
  trainee_review: TraineeReviewInput;
  development_timeline: DevelopmentTimelineInput;
  next_focus: NextFocusInput;
  final_evaluation: FinalEvaluationInput;
  trainee_overview: TraineeOverviewInput;
  trainee_file_extract: TraineeFileExtractInput;
};
export type AITaskInput<T extends AITask> = AITaskInputMap[T];

/* --------------------------------------------------------------------------
 * Per-task structured outputs.
 * ------------------------------------------------------------------------ */

export type ChatOutput = { reply: string };

/** Raw notes → professional feedback, in a recognised coaching structure. */
export type FeedbackPolishOutput = {
  model: "SBI" | "AAR" | "GROW" | "other";
  polishedText: string;
  sections: { title: string; body: string }[];
};

export type FeedbackSummaryOutput = {
  summary: string;
  highlights: string[];
  sourceFeedbackIds: string[];
};

export type TraineeReviewOutput = {
  summary: string;
  strengths: string[];
  gaps: string[];
  keep: string[];
  improve: string[];
  patterns: string[];
  sourceFeedbackIds: string[];
};

export type TimelinePointKind = "start" | "event" | "trend" | "improvement" | "open";
export type DevelopmentTimelineOutput = {
  points: {
    at: string;
    title: string;
    kind: TimelinePointKind;
    detail: string;
    sourceFeedbackIds: string[];
  }[];
  sourceFeedbackIds: string[];
};

export type NextFocusOutput = {
  focus: string;
  rationale: string;
  recommendations: string[];
  sourceFeedbackIds: string[];
};

/** A course-end evaluation is a RECOMMENDATION only — never an official readiness ruling. */
export const FINAL_EVALUATION_READINESS = [
  "supported",
  "needs_review",
  "insufficient_information",
  "concerns",
] as const;
export type FinalEvaluationReadiness = (typeof FINAL_EVALUATION_READINESS)[number];

export type FinalEvaluationOutput = {
  /** Professional Hebrew narrative of the trainee's functioning across the course. */
  overallEvaluation: string;
  /** A recommendation (NOT a formal ruling) on command/instruction readiness. */
  commandAndInstructionReadiness: {
    recommendation: FinalEvaluationReadiness;
    reasoning: string;
  };
  /** Concrete, evidence-based pointers for commanders. */
  commanderNotes: string[];
  /** Structure areas that lack sufficient evidence (never filled by speculation). */
  evidenceGaps: string[];
  sourceFeedbackIds: string[];
};

/** A single chronological milestone (shared by the timeline artifact and the
 *  timeline section inside the aggregated review). */
export type TimelinePoint = {
  at: string;
  title: string;
  kind: TimelinePointKind;
  detail: string;
  sourceFeedbackIds: string[];
};

/**
 * The AGGREGATED review ("סקירה") — the single AI product shown to the user. One
 * structured call produces all sections, so the UI is unified and we avoid firing
 * three or four separate provider calls. Persisted as ONE versioned TraineeAIInsight
 * (artifactType "trainee_overview"); staleness applies to it as a whole. The older
 * per-section tasks remain in the codebase but the workspace no longer drives them.
 */
export type TraineeOverviewOutput = {
  /** 1. תמונת מצב כללית — evidence-based overall picture. */
  snapshot: string;
  /** מגמות מרכזיות — only when supported by more than a single event. */
  trends: string[];
  /** 2. חוזקות / נקודות לשימור. */
  strengths: string[];
  /** 3. פערים / נקודות לשיפור. */
  gaps: string[];
  /** 4. מוקדים להמשך — practical, actionable focus areas. */
  focus: string[];
  /** 5. ציר התפתחות — chronological; empty when there is not enough evidence. */
  timeline: { points: TimelinePoint[] };
  /** 6. חוות דעת סוף — the draft (recommendation only, never an official ruling). */
  finalEvaluation: {
    overallEvaluation: string;
    readiness: { recommendation: FinalEvaluationReadiness; reasoning: string };
    commanderNotes: string[];
    evidenceGaps: string[];
  };
  sourceFeedbackIds: string[];
};

/**
 * Structured fields extracted from an uploaded trainee-file document. The AI is NOT
 * an authority on course/cohort/role — it only proposes CONTENT fields the human then
 * reviews. Fields not clearly present in the document are null / empty (never guessed);
 * `suggestedCohortName` is a free-text hint the human maps to a real, permitted cohort.
 */
export type TraineeFileExtractOutput = {
  fullName: string | null;
  team: string | null;
  strengths: string[];
  weaknesses: string[];
  notes: string | null;
  suggestedCohortName: string | null;
  /** Names of fields the model could not determine from the document. */
  missingFields: string[];
};

export type AITaskOutputMap = {
  chat: ChatOutput;
  feedback_polish: FeedbackPolishOutput;
  feedback_summary: FeedbackSummaryOutput;
  trainee_review: TraineeReviewOutput;
  development_timeline: DevelopmentTimelineOutput;
  next_focus: NextFocusOutput;
  final_evaluation: FinalEvaluationOutput;
  trainee_overview: TraineeOverviewOutput;
  trainee_file_extract: TraineeFileExtractOutput;
};
export type AITaskOutput<T extends AITask> = AITaskOutputMap[T];

/* --------------------------------------------------------------------------
 * Result envelope — never conflate "not connected" with a real answer.
 * ------------------------------------------------------------------------ */

/** Non-sensitive token usage, when the provider reports it (never persisted raw). */
export type AIUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

/**
 * Internal, client-safe error categories mapped from provider failures. Carried on
 * the `not_configured`/`error` envelope so the UI can react without ever seeing a raw
 * provider error, stack trace, headers, or the API key.
 */
export const AI_ERROR_CATEGORIES = [
  "not_configured",
  "configuration_error",
  "authentication_error",
  "insufficient_quota",
  "rate_limited",
  "timeout",
  "invalid_output",
  "context_too_large",
  "input_too_large",
  "provider_error",
] as const;
export type AIErrorCategory = (typeof AI_ERROR_CATEGORIES)[number];

export type AIResult<T> =
  | { status: "ok"; task: AITask; output: T; provider: string; model: string; contextHash: string; usage?: AIUsage }
  | { status: "not_configured"; task: AITask; provider: string; message: string; category?: AIErrorCategory }
  | { status: "error"; task: AITask; provider: string; message: string; category?: AIErrorCategory };

export type AnyAIResult = AIResult<AITaskOutput<AITask>>;
