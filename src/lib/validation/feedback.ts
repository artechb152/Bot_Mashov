import { isFeedbackType } from "@/lib/domain/types";
import type { FeedbackInput } from "@/lib/data/feedback";

/**
 * Validate + normalise a feedback request body (mirrors validation/trainee.ts).
 * - `partial: false` (create) → feedbackType + rawText are required.
 * - `partial: true`  (update) → only provided fields are validated.
 */
export type FeedbackParseResult =
  | { ok: true; data: Partial<FeedbackInput> }
  | { ok: false; errors: string[] };

export function parseFeedbackBody(body: unknown, partial: boolean): FeedbackParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["גוף הבקשה אינו תקין."] };
  }
  const b = body as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const errors: string[] = [];
  const data: Partial<FeedbackInput> = {};

  if (!partial || has("title")) {
    data.title = typeof b.title === "string" ? b.title.trim() : "";
  }
  if (!partial || has("feedbackType")) {
    if (isFeedbackType(b.feedbackType)) data.feedbackType = b.feedbackType;
    else errors.push("סוג המשוב אינו תקין.");
  }
  if (!partial || has("rawText")) {
    const t = typeof b.rawText === "string" ? b.rawText.trim() : "";
    if (!t) errors.push("תוכן המשוב הוא שדה חובה.");
    else data.rawText = t;
  }
  if (!partial || has("selectedAction")) {
    data.selectedAction = typeof b.selectedAction === "string" ? b.selectedAction.trim() : "";
  }

  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("לא נשלחו שדות לעדכון.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, data };
}
