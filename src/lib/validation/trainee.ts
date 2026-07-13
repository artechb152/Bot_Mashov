import { linesToArray } from "@/lib/text";
import type { TraineeInput } from "@/lib/data/trainees";

export type ParseResult =
  | { ok: true; data: Partial<TraineeInput> }
  | { ok: false; errors: string[] };

/** Accept either an array of strings or free text (one item per line). */
function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === "string") return linesToArray(value);
  return [];
}

/** Accept only text or an array as a strengths/weaknesses input (reject numbers, objects, …). */
function isStringArrayOrText(value: unknown): boolean {
  return typeof value === "string" || Array.isArray(value);
}

/**
 * Validate and normalise a trainee request body.
 * - `partial: false` (create) → fullName is required.
 * - `partial: true` (update) → only the provided fields are validated.
 */
export function parseTraineeBody(body: unknown, partial: boolean): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["גוף הבקשה אינו תקין."] };
  }

  const b = body as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(b, key);
  const errors: string[] = [];
  const data: Partial<TraineeInput> = {};

  if (!partial || has("fullName")) {
    const name = typeof b.fullName === "string" ? b.fullName.trim() : "";
    if (!name) errors.push("שם מלא הוא שדה חובה.");
    else data.fullName = name;
  }

  if (!partial || has("team")) {
    data.team = typeof b.team === "string" ? b.team.trim() : "";
  }
  if (!partial || has("strengths")) {
    if (has("strengths") && !isStringArrayOrText(b.strengths)) {
      errors.push("חוזקות חייבות להיות רשימת טקסט (שורה לכל פריט).");
    } else {
      data.strengths = normalizeStringArray(b.strengths);
    }
  }
  if (!partial || has("weaknesses")) {
    if (has("weaknesses") && !isStringArrayOrText(b.weaknesses)) {
      errors.push("חולשות חייבות להיות רשימת טקסט (שורה לכל פריט).");
    } else {
      data.weaknesses = normalizeStringArray(b.weaknesses);
    }
  }
  if (!partial || has("notes")) {
    data.notes = typeof b.notes === "string" ? b.notes.trim() : "";
  }

  // Only complain about "no fields" when the body truly had none — not when the
  // provided fields were present but invalid (those already produced errors).
  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("לא נשלחו שדות לעדכון.");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data };
}
