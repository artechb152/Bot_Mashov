/**
 * חונך+ AI layer — structured-output validation (Stage 0).
 *
 * Hand-rolled runtime validators (the repo has no Zod/validation dep — same
 * approach as the `is*` guards in `@/lib/domain/types`). Every provider output is
 * validated here before it is returned or persisted, so a malformed answer from a
 * future real provider becomes a clean "error" rather than corrupt data.
 *
 * Pure — no DB/HTTP/DOM.
 */
import type { AITask, AITaskOutput } from "./types";

/** Returns a list of human-readable problems; empty array = valid. */
export type Validation = string[];

const isStr = (v: unknown): v is string => typeof v === "string";
const isNonEmptyStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function strArray(v: unknown, path: string, out: Validation): void {
  if (!Array.isArray(v) || !v.every(isStr)) out.push(`${path} חייב להיות מערך מחרוזות`);
}

function requireNonEmpty(v: unknown, path: string, out: Validation): void {
  if (!isNonEmptyStr(v)) out.push(`${path} חייב להיות מחרוזת לא-ריקה`);
}

/** A string OR null (used for extracted fields that may be legitimately absent). */
function nullableStr(v: unknown, path: string, out: Validation): void {
  if (v !== null && !isStr(v)) out.push(`${path} חייב להיות מחרוזת או null`);
}

const TIMELINE_KINDS = ["start", "event", "trend", "improvement", "open"];
const isTimelinePoint = (p: unknown): boolean =>
  isObj(p) &&
  isStr(p.at) &&
  isStr(p.title) &&
  isStr(p.kind) &&
  TIMELINE_KINDS.includes(p.kind as string) &&
  isStr(p.detail) &&
  Array.isArray(p.sourceFeedbackIds) &&
  p.sourceFeedbackIds.every(isStr);

const READINESS = ["supported", "needs_review", "insufficient_information", "concerns"];

const VALIDATORS: { [K in AITask]: (o: unknown) => Validation } = {
  chat(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    requireNonEmpty(o.reply, "reply", e);
    return e;
  },
  feedback_polish(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    if (!isStr(o.model) || !["SBI", "AAR", "GROW", "other"].includes(o.model)) e.push("model לא חוקי");
    requireNonEmpty(o.polishedText, "polishedText", e);
    if (!Array.isArray(o.sections) || !o.sections.every((s) => isObj(s) && isStr(s.title) && isStr(s.body)))
      e.push("sections חייב להיות מערך של {title, body}");
    return e;
  },
  feedback_summary(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    requireNonEmpty(o.summary, "summary", e);
    strArray(o.highlights, "highlights", e);
    strArray(o.sourceFeedbackIds, "sourceFeedbackIds", e);
    return e;
  },
  trainee_review(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    requireNonEmpty(o.summary, "summary", e);
    strArray(o.strengths, "strengths", e);
    strArray(o.gaps, "gaps", e);
    strArray(o.keep, "keep", e);
    strArray(o.improve, "improve", e);
    strArray(o.patterns, "patterns", e);
    strArray(o.sourceFeedbackIds, "sourceFeedbackIds", e);
    return e;
  },
  development_timeline(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    if (!Array.isArray(o.points) || !o.points.every(isTimelinePoint))
      e.push("points חייב להיות מערך נקודות תקין (at,title,kind,detail,sourceFeedbackIds)");
    strArray(o.sourceFeedbackIds, "sourceFeedbackIds", e);
    return e;
  },
  next_focus(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    requireNonEmpty(o.focus, "focus", e);
    requireNonEmpty(o.rationale, "rationale", e);
    strArray(o.recommendations, "recommendations", e);
    strArray(o.sourceFeedbackIds, "sourceFeedbackIds", e);
    return e;
  },
  final_evaluation(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    requireNonEmpty(o.overallEvaluation, "overallEvaluation", e);
    const r = o.commandAndInstructionReadiness;
    if (!isObj(r) || !isStr(r.recommendation) || !READINESS.includes(r.recommendation as string)) {
      e.push("commandAndInstructionReadiness.recommendation לא חוקי");
    }
    if (!isObj(r) || !isNonEmptyStr(r.reasoning)) {
      e.push("commandAndInstructionReadiness.reasoning חייב להיות מחרוזת לא-ריקה");
    }
    strArray(o.commanderNotes, "commanderNotes", e);
    strArray(o.evidenceGaps, "evidenceGaps", e);
    strArray(o.sourceFeedbackIds, "sourceFeedbackIds", e);
    return e;
  },
  trainee_overview(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    requireNonEmpty(o.snapshot, "snapshot", e);
    strArray(o.trends, "trends", e);
    strArray(o.strengths, "strengths", e);
    strArray(o.gaps, "gaps", e);
    strArray(o.focus, "focus", e);
    const tl = o.timeline;
    if (!isObj(tl) || !Array.isArray(tl.points) || !tl.points.every(isTimelinePoint)) {
      e.push("timeline.points חייב להיות מערך נקודות תקין");
    }
    const fe = o.finalEvaluation;
    if (!isObj(fe)) {
      e.push("finalEvaluation חייב להיות אובייקט");
    } else {
      requireNonEmpty(fe.overallEvaluation, "finalEvaluation.overallEvaluation", e);
      const r = fe.readiness;
      if (!isObj(r) || !isStr(r.recommendation) || !READINESS.includes(r.recommendation as string)) {
        e.push("finalEvaluation.readiness.recommendation לא חוקי");
      }
      if (!isObj(r) || !isNonEmptyStr(r.reasoning)) {
        e.push("finalEvaluation.readiness.reasoning חייב להיות מחרוזת לא-ריקה");
      }
      strArray(fe.commanderNotes, "finalEvaluation.commanderNotes", e);
      strArray(fe.evidenceGaps, "finalEvaluation.evidenceGaps", e);
    }
    strArray(o.sourceFeedbackIds, "sourceFeedbackIds", e);
    return e;
  },
  trainee_file_extract(o) {
    const e: Validation = [];
    if (!isObj(o)) return ["output אינו אובייקט"];
    nullableStr(o.fullName, "fullName", e);
    nullableStr(o.team, "team", e);
    strArray(o.strengths, "strengths", e);
    strArray(o.weaknesses, "weaknesses", e);
    nullableStr(o.notes, "notes", e);
    nullableStr(o.suggestedCohortName, "suggestedCohortName", e);
    strArray(o.missingFields, "missingFields", e);
    return e;
  },
};

/** Validate a provider output for a task. Returns [] when valid. */
export function validateTaskOutput(task: AITask, output: unknown): Validation {
  return VALIDATORS[task](output);
}

/** Type-guard form: narrows `output` to the task's structured output type. */
export function isValidTaskOutput<T extends AITask>(task: T, output: unknown): output is AITaskOutput<T> {
  return VALIDATORS[task](output).length === 0;
}
