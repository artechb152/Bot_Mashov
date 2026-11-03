/**
 * חונך+ AI layer — the Context Builder (Stage 0).
 *
 * Pure functions that assemble the authorized {@link AIContext} a provider is
 * allowed to see. The single most important rule lives here: **only the SELECTED
 * feedback enters the context.** The selection is applied here (not trusted from
 * the provider), and the caller must pass only feedback the viewer is authorized
 * to read (enforced upstream by `requireTraineeAccess`). No DB/HTTP/DOM.
 */
import { createHash } from "node:crypto";
import type { AIContext, AIFeedbackItem, AITraineeContext } from "./types";

/** Selection can be an explicit id list or the sentinel "all". */
export type FeedbackSelection = string[] | "all";

/**
 * Reduce a trainee's full feedback set to the entries that should ground the AI,
 * returned in chronological order. Ids that are not present are ignored (never
 * fabricated); an empty explicit selection yields an empty list.
 */
export function selectFeedbackForContext(
  allFeedback: AIFeedbackItem[],
  selection: FeedbackSelection,
): AIFeedbackItem[] {
  const chosen =
    selection === "all"
      ? allFeedback.slice()
      : allFeedback.filter((f) => selection.includes(f.id));
  return chosen.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Assemble the context for a trainee-grounded task. `allFeedback` is the viewer's
 * authorized feedback set; `selection` narrows it to the AI sources. The returned
 * `context.feedback` is guaranteed to contain ONLY selected entries.
 */
export function buildTraineeAIContext(params: {
  systemPrompt: string;
  systemPromptVersion: string;
  knowledgeExcerpts: string[];
  knowledgeVersion: string;
  trainee: AITraineeContext | null;
  allFeedback: AIFeedbackItem[];
  selection: FeedbackSelection;
  /** Optional per-task reference knowledge (guides/examples), rendered separately. */
  taskKnowledge?: string[];
}): AIContext {
  return {
    systemPrompt: params.systemPrompt,
    systemPromptVersion: params.systemPromptVersion,
    knowledgeExcerpts: params.knowledgeExcerpts,
    taskKnowledge: params.taskKnowledge,
    knowledgeVersion: params.knowledgeVersion,
    trainee: params.trainee,
    feedback: selectFeedbackForContext(params.allFeedback, params.selection),
    locale: "he",
  };
}

/**
 * A stable fingerprint of everything that determines a derived artifact
 * (trainee_review / development_timeline / …). Persisted on `TraineeAIInsight`
 * (later stage) so an insight can be marked STALE the moment its inputs change —
 * a source feedback edited/added, the system prompt, or the knowledge version.
 * Deterministic: same inputs → same hash; order-independent for feedback.
 */
export function computeContextHash(context: AIContext): string {
  const feedbackFingerprint = context.feedback
    .map((f) => `${f.id}:${f.updatedAt ?? f.createdAt}`)
    .sort();
  const canonical = JSON.stringify({
    trainee: context.trainee?.id ?? null,
    feedback: feedbackFingerprint,
    systemPromptVersion: context.systemPromptVersion,
    knowledgeVersion: context.knowledgeVersion,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Short stable version tag for a text blob (system prompt / knowledge bundle). */
export function versionOf(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}
