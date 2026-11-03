/**
 * חונך+ AI layer — JSON Schemas for OpenAI Structured Outputs (Responses API).
 *
 * These describe the SAME shapes the hand-rolled validators in `./schemas.ts` accept.
 * `validateTaskOutput` remains the single source of truth for ACCEPTANCE (every output
 * is re-validated server-side before persistence); these schemas only constrain what
 * the model is asked to return. `scripts/check-openai.ts` asserts the two stay in sync
 * (a schema's required keys must equal the keys the validator/mock produce), so they
 * can never silently drift apart. Pure data — no DB/HTTP/DOM.
 */
import type { AITask } from "./types";

/** OpenAI strict Structured Outputs require every property listed in `required`
 *  and `additionalProperties: false`. These are the tasks that return JSON. */
export const STRUCTURED_TASKS = [
  "feedback_polish",
  "feedback_summary",
  "trainee_review",
  "development_timeline",
  "next_focus",
  "final_evaluation",
  "trainee_overview",
  "trainee_file_extract",
] as const;
export type StructuredTask = (typeof STRUCTURED_TASKS)[number];

export function isStructuredTask(task: AITask): task is StructuredTask {
  return (STRUCTURED_TASKS as readonly string[]).includes(task);
}

type JSONSchema = Record<string, unknown>;
const strArray = (): JSONSchema => ({ type: "array", items: { type: "string" } });
/** A string that the model may return as null when the value is absent (strict-mode
 *  nullability — the key is still required, its value may be a string or null). */
const nullableStr = (): JSONSchema => ({ type: ["string", "null"] });
const TIMELINE_POINT = (): JSONSchema =>
  ({
    type: "object",
    additionalProperties: false,
    required: ["at", "title", "kind", "detail", "sourceFeedbackIds"],
    properties: {
      at: { type: "string" },
      title: { type: "string" },
      kind: { type: "string", enum: ["start", "event", "trend", "improvement", "open"] },
      detail: { type: "string" },
      sourceFeedbackIds: strArray(),
    },
  });
const obj = (properties: Record<string, JSONSchema>): JSONSchema => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

const SCHEMAS: Record<StructuredTask, JSONSchema> = {
  feedback_polish: obj({
    model: { type: "string", enum: ["SBI", "AAR", "GROW", "other"] },
    polishedText: { type: "string" },
    sections: {
      type: "array",
      items: obj({ title: { type: "string" }, body: { type: "string" } }),
    },
  }),
  feedback_summary: obj({
    summary: { type: "string" },
    highlights: strArray(),
    sourceFeedbackIds: strArray(),
  }),
  trainee_review: obj({
    summary: { type: "string" },
    strengths: strArray(),
    gaps: strArray(),
    keep: strArray(),
    improve: strArray(),
    patterns: strArray(),
    sourceFeedbackIds: strArray(),
  }),
  development_timeline: obj({
    points: { type: "array", items: TIMELINE_POINT() },
    sourceFeedbackIds: strArray(),
  }),
  next_focus: obj({
    focus: { type: "string" },
    rationale: { type: "string" },
    recommendations: strArray(),
    sourceFeedbackIds: strArray(),
  }),
  final_evaluation: obj({
    overallEvaluation: { type: "string" },
    commandAndInstructionReadiness: obj({
      recommendation: {
        type: "string",
        enum: ["supported", "needs_review", "insufficient_information", "concerns"],
      },
      reasoning: { type: "string" },
    }),
    commanderNotes: strArray(),
    evidenceGaps: strArray(),
    sourceFeedbackIds: strArray(),
  }),
  trainee_overview: obj({
    snapshot: { type: "string" },
    trends: strArray(),
    strengths: strArray(),
    gaps: strArray(),
    focus: strArray(),
    timeline: obj({ points: { type: "array", items: TIMELINE_POINT() } }),
    finalEvaluation: obj({
      overallEvaluation: { type: "string" },
      readiness: obj({
        recommendation: {
          type: "string",
          enum: ["supported", "needs_review", "insufficient_information", "concerns"],
        },
        reasoning: { type: "string" },
      }),
      commanderNotes: strArray(),
      evidenceGaps: strArray(),
    }),
    sourceFeedbackIds: strArray(),
  }),
  trainee_file_extract: obj({
    fullName: nullableStr(),
    team: nullableStr(),
    strengths: strArray(),
    weaknesses: strArray(),
    notes: nullableStr(),
    suggestedCohortName: nullableStr(),
    missingFields: strArray(),
  }),
};

/** The OpenAI `text.format` payload for a structured task (json_schema, strict). */
export function taskResponseFormat(task: StructuredTask): {
  type: "json_schema";
  name: string;
  strict: true;
  schema: JSONSchema;
} {
  return { type: "json_schema", name: `${task}_output`, strict: true, schema: SCHEMAS[task] };
}

/** The raw JSON schema for a structured task (used by tests + the provider). */
export function taskJsonSchema(task: StructuredTask): JSONSchema {
  return SCHEMAS[task];
}
