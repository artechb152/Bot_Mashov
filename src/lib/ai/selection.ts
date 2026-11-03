/**
 * חונך+ AI layer — feedback-source selection helpers (Stage 2). Pure.
 *
 * The source-selection safety rules, isolated for unit testing:
 *   - `sanitizeSelection` drops any id that is not one of the trainee's own feedback
 *     (client-supplied ids for another trainee / non-existent are rejected).
 *   - `selectFeedbackForAI` builds the AI context feedback: ACTIVE only, SELECTED
 *     only, chronological. Archived-but-selected entries never enter the context.
 *   - `allActiveIds` is the default selection for a new conversation (all active).
 */
import { selectFeedbackForContext, type FeedbackSelection } from "./context";
import type { AIFeedbackItem } from "./types";
import type { FeedbackStatus } from "@/lib/domain/types";

/** A trainee feedback item plus its lifecycle status (from the DB, any status). */
export type FeedbackForSelection = AIFeedbackItem & { status: FeedbackStatus };

/** Keep only ids that belong to the trainee's feedback set (existence/authorization). */
export function sanitizeSelection(selection: string[], items: { id: string }[]): string[] {
  const existing = new Set(items.map((i) => i.id));
  return selection.filter((id) => existing.has(id));
}

/** All ACTIVE feedback ids — the default source selection for a new conversation. */
export function allActiveIds(items: FeedbackForSelection[]): string[] {
  return items.filter((i) => i.status === "active").map((i) => i.id);
}

/**
 * Whether a stored artifact becomes STALE after a feedback change (mirrors the DB
 * filter in `markInsightsStaleForTrainee`): a new source (no `changedFeedbackId`)
 * invalidates every artifact; an edited/archived/restored source invalidates only
 * the artifacts that cite it.
 */
export function insightNeedsStale(sourceFeedbackIds: string[], changedFeedbackId?: string): boolean {
  if (!changedFeedbackId) return true;
  return sourceFeedbackIds.includes(changedFeedbackId);
}

/**
 * The context feedback for an AI call: from the trainee's feedback, keep only the
 * ACTIVE entries, then only those in `selection`, chronological. Never leaks an
 * archived or unselected entry.
 */
export function selectFeedbackForAI(
  items: FeedbackForSelection[],
  selection: FeedbackSelection,
): AIFeedbackItem[] {
  const active: AIFeedbackItem[] = items
    .filter((i) => i.status === "active")
    .map((i) => ({
      id: i.id,
      feedbackType: i.feedbackType,
      rawText: i.rawText,
      selectedAction: i.selectedAction,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));
  return selectFeedbackForContext(active, selection);
}
