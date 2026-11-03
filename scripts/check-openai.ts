/**
 * OpenAI provider + final_evaluation checks (Stage: real AI). No network, no real
 * OpenAI calls — the SDK client is a fake injected into `createOpenAIProvider`. Run
 * via tsx, like the other check scripts.
 *
 * Covers:
 *   1. Provider selection from env (null / mock / mock-in-prod / openai / missing key /
 *      missing model / unknown) and that getAIStatus never exposes the key.
 *   2. The provider uses the Responses API, reads the model from config, requests
 *      structured JSON for structured tasks, and never leaks the API key.
 *   3. Context safety at the prompt boundary: only the context feedback is sent,
 *      chronological order, source markers, and the usage/limit guards.
 *   4. Error mapping (auth / quota / rate-limit / timeout / provider) with no raw leak.
 *   5. Structured-output validation gate + schema↔validator sync.
 *   6. final_evaluation: enum/routing, schema enforcement, evidence gaps, recommendation
 *      is advisory only, artifact (supersede/stale) semantics.
 *
 * Run:  npx tsx scripts/check-openai.ts   (or: npm run check:openai)
 */
import { createOpenAIProvider, type OpenAIResponsesClient } from "@/lib/ai/openai-provider";
import { resolveAIConfig, getAIStatus, getAIProvider } from "@/lib/ai";
import { buildTraineeAIContext } from "@/lib/ai/context";
import { validateTaskOutput } from "@/lib/ai/schemas";
import { STRUCTURED_TASKS, taskJsonSchema } from "@/lib/ai/json-schemas";
import { mockProvider } from "@/lib/ai/mock-provider";
import { AI_ARTIFACT_TASKS, isAITask, isAIArtifactTask } from "@/lib/ai/types";
import type { AIContext, AITask, FinalEvaluationOutput, TraineeOverviewOutput } from "@/lib/ai/types";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`);
  }
}
const ok = (name: string, cond: boolean) => check(name, cond, true);

/* --- Fakes + fixtures ---------------------------------------------------- */
type Captured = { params: Record<string, unknown> | null };
function fakeClient(opts: { text?: string; throwErr?: unknown }): { client: OpenAIResponsesClient; captured: Captured } {
  const captured: Captured = { params: null };
  const client: OpenAIResponsesClient = {
    responses: {
      create: async (params) => {
        captured.params = params as unknown as Record<string, unknown>;
        if (opts.throwErr) throw opts.throwErr;
        return { output_text: opts.text ?? "", usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 }, id: "resp_1" };
      },
    },
  };
  return { client, captured };
}

const API_KEY = "sk-secret-DO-NOT-LEAK-123";
const MODEL = "test-model-x";

function ctxWith(
  feedback: { id: string; rawText: string; createdAt: string }[],
  selection: string[] | "all" = "all",
  taskKnowledge: string[] = ["## מדריך\nתוכן מדריך"],
): AIContext {
  return buildTraineeAIContext({
    systemPrompt: "הוראות מערכת לבדיקה",
    systemPromptVersion: "spv",
    knowledgeExcerpts: ["## דוקטרינה\nידע מחייב"],
    knowledgeVersion: "kv",
    taskKnowledge,
    trainee: { id: "t1", fullName: "חניך בדיקה", courseType: "kapeh" },
    allFeedback: feedback.map((f) => ({ id: f.id, feedbackType: "lesson", rawText: f.rawText, createdAt: f.createdAt })),
    selection,
  });
}

const validReview = {
  summary: "תמצית",
  strengths: ["א"],
  gaps: ["ב"],
  keep: ["ג"],
  improve: ["ד"],
  patterns: [],
  sourceFeedbackIds: ["f1"],
};

function withEnv(env: Record<string, string | undefined>, fn: () => void): void {
  const keys = ["AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL", "NODE_ENV"];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  for (const k of keys) {
    if (k in env) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

async function main(): Promise<void> {
/* --- 1. Provider selection ---------------------------------------------- */
console.log("\nprovider selection (resolveAIConfig)\n");
withEnv({ AI_PROVIDER: undefined, NODE_ENV: "development" }, () => check("unset → null", resolveAIConfig().category, "null"));
withEnv({ AI_PROVIDER: "mock", NODE_ENV: "development" }, () => check("mock (dev) → mock", resolveAIConfig().category, "mock"));
withEnv({ AI_PROVIDER: "mock", NODE_ENV: "production" }, () => check("mock (prod) → null", resolveAIConfig().category, "null"));
withEnv({ AI_PROVIDER: "openai", OPENAI_API_KEY: undefined, OPENAI_MODEL: MODEL }, () =>
  check("openai no key → openai_missing_key", resolveAIConfig().category, "openai_missing_key"),
);
withEnv({ AI_PROVIDER: "openai", OPENAI_API_KEY: API_KEY, OPENAI_MODEL: undefined }, () =>
  check("openai no model → openai_missing_model", resolveAIConfig().category, "openai_missing_model"),
);
withEnv({ AI_PROVIDER: "openai", OPENAI_API_KEY: API_KEY, OPENAI_MODEL: MODEL }, () => {
  check("openai key+model → openai", resolveAIConfig().category, "openai");
  check("getAIProvider() name is openai", getAIProvider().name, "openai");
  const status = getAIStatus();
  ok("openai configured → configured true", status.configured === true && status.mock === false);
  ok("getAIStatus never contains the key", !JSON.stringify(status).includes(API_KEY));
});
withEnv({ AI_PROVIDER: "bogus", NODE_ENV: "development" }, () =>
  check("unknown → configuration_error", resolveAIConfig().category, "configuration_error"),
);
withEnv({ AI_PROVIDER: "openai", OPENAI_API_KEY: undefined, OPENAI_MODEL: MODEL }, () =>
  ok("missing key provider → not_configured", getAIProvider().name === "openai"),
);

/* --- 2. Responses API usage + no key leak -------------------------------- */
console.log("\nprovider run — Responses API + structured\n");
{
  const { client, captured } = fakeClient({ text: JSON.stringify(validReview) });
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client });
  const ctx = ctxWith([{ id: "f1", rawText: "אלפא", createdAt: "2026-01-01T00:00:00.000Z" }]);
  const res = await provider.run("trainee_review", {}, ctx);
  ok("structured run ok", res.status === "ok");
  if (res.status === "ok") check("structured output parsed", res.output.summary, "תמצית");
  check("model comes from config", captured.params?.model, MODEL);
  ok("max_output_tokens set", typeof captured.params?.max_output_tokens === "number");
  const format = (captured.params?.text as { format?: { type?: string; strict?: boolean } })?.format;
  check("structured task requests json_schema", format?.type, "json_schema");
  ok("json_schema strict", format?.strict === true);
  ok("result never contains the API key", !JSON.stringify(res).includes(API_KEY));
  ok("params sent to provider never contain the API key", !JSON.stringify(captured.params).includes(API_KEY));
  ok("usage mapped", res.status === "ok" && res.usage?.totalTokens === 15);
}
{
  const { client, captured } = fakeClient({ text: "תשובת צ׳אט" });
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client });
  const res = await provider.run("chat", { messages: [{ role: "user", content: "שלום" }] }, ctxWith([]));
  ok("chat run ok", res.status === "ok");
  if (res.status === "ok") check("chat reply", res.output.reply, "תשובת צ׳אט");
  ok("chat sends NO json_schema format", captured.params?.text === undefined);
}

/* --- 3. Context safety at the boundary ----------------------------------- */
console.log("\ncontext safety (prompt boundary)\n");
{
  const feedback = [
    { id: "f2", rawText: "בטא", createdAt: "2026-01-02T00:00:00.000Z" },
    { id: "f1", rawText: "אלפא", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "f3", rawText: "גמא", createdAt: "2026-01-03T00:00:00.000Z" },
  ];
  const { client, captured } = fakeClient({ text: JSON.stringify(validReview) });
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client });
  // Only f1 + f3 selected → f2 must never reach the prompt.
  await provider.run("trainee_review", {}, ctxWith(feedback, ["f1", "f3"]));
  const input = String(captured.params?.input ?? "");
  ok("selected feedback present", input.includes("אלפא") && input.includes("גמא"));
  ok("unselected feedback absent", !input.includes("בטא"));
  ok("source id markers present (traceability)", input.includes("source:f1") && input.includes("source:f3"));
  ok("chronological order (f1 before f3)", input.indexOf("אלפא") < input.indexOf("גמא"));
  const instructions = String(captured.params?.instructions ?? "");
  ok("instructions carry binding knowledge", instructions.includes("ידע מחייב"));
  ok("instructions carry the safety block", instructions.includes("הגנת הזרקה"));
}
{
  // Empty selection stays empty — the prompt says so, never silently "all".
  const { client, captured } = fakeClient({ text: JSON.stringify(validReview) });
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client });
  await provider.run("trainee_review", {}, ctxWith([{ id: "f1", rawText: "אלפא", createdAt: "2026-01-01T00:00:00.000Z" }], []));
  ok("empty selection → 'בחירה ריקה' in prompt", String(captured.params?.input).includes("בחירה ריקה"));
}

/* --- limits ---------------------------------------------------------------*/
console.log("\nusage limits (no silent truncation)\n");
{
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client: fakeClient({ text: "{}" }).client });
  const many = Array.from({ length: 301 }, (_, i) => ({ id: `f${i}`, rawText: "x", createdAt: "2026-01-01T00:00:00.000Z" }));
  const res = await provider.run("trainee_review", {}, ctxWith(many));
  ok("too many feedback → context_too_large error", res.status === "error" && res.category === "context_too_large");
}
{
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client: fakeClient({ text: "{}" }).client });
  const big = "א".repeat(6_001);
  const res = await provider.run("chat", { messages: [{ role: "user", content: big }] }, ctxWith([]));
  ok("oversized user message → input_too_large error", res.status === "error" && res.category === "input_too_large");
}

/* --- 4. Error mapping ---------------------------------------------------- */
console.log("\nerror mapping (no raw leak)\n");
async function runWithError(throwErr: unknown): Promise<string | undefined> {
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client: fakeClient({ throwErr }).client });
  const res = await provider.run("chat", { messages: [{ role: "user", content: "hi" }] }, ctxWith([]));
  return res.status === "error" ? res.category : undefined;
}
check("401 → authentication_error", await runWithError({ status: 401 }), "authentication_error");
check("insufficient_quota", await runWithError({ status: 429, code: "insufficient_quota" }), "insufficient_quota");
check("429 → rate_limited", await runWithError({ status: 429 }), "rate_limited");
check("timeout", await runWithError({ name: "APIConnectionTimeoutError" }), "timeout");
check("generic → provider_error", await runWithError(new Error("boom")), "provider_error");
{
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client: fakeClient({ throwErr: new Error("boom secret") }).client });
  const res = await provider.run("chat", { messages: [{ role: "user", content: "hi" }] }, ctxWith([]));
  ok("error result carries no raw provider message", res.status === "error" && !res.message.includes("boom"));
}

/* --- 5. Structured-output validation gate + schema↔validator sync --------- */
console.log("\nstructured output validation + schema sync\n");
{
  // Provider returns non-JSON for a structured task → invalid_output.
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client: fakeClient({ text: "לא JSON" }).client });
  const res = await provider.run("trainee_review", {}, ctxWith([{ id: "f1", rawText: "x", createdAt: "2026-01-01T00:00:00.000Z" }]));
  ok("non-JSON structured → invalid_output", res.status === "error" && res.category === "invalid_output");
}
{
  // Provider returns schema-invalid JSON → provider says ok, but validateTaskOutput rejects it.
  const bad = { summary: "", strengths: "not-array" };
  check("validateTaskOutput rejects schema-invalid review", validateTaskOutput("trainee_review", bad).length > 0, true);
}
for (const task of STRUCTURED_TASKS) {
  const input =
    task === "feedback_polish"
      ? { rawText: "הערה", feedbackType: "lesson" as const }
      : task === "trainee_file_extract"
        ? { text: "אלון כהן\nהערה על תפקוד" }
        : {};
  const ctx = ctxWith([{ id: "f1", rawText: "אלפא", createdAt: "2026-01-01T00:00:00.000Z" }]);
  const out = await mockProvider.run(task as AITask, input as never, ctx);
  if (out.status !== "ok") {
    failures++;
    console.error(`  ✗ mock ${task} not ok`);
    continue;
  }
  check(`${task}: mock output valid`, validateTaskOutput(task as AITask, out.output).length, 0);
  const required = (taskJsonSchema(task).required as string[]).slice().sort();
  check(`${task}: schema keys == output keys`, Object.keys(out.output as object).sort(), required);
}

/* --- 6. final_evaluation ------------------------------------------------- */
console.log("\nfinal_evaluation\n");
ok("final_evaluation is an AI task", isAITask("final_evaluation"));
ok("final_evaluation is an artifact task (supersede/stale like others)", isAIArtifactTask("final_evaluation"));
ok("final_evaluation in AI_ARTIFACT_TASKS", (AI_ARTIFACT_TASKS as readonly string[]).includes("final_evaluation"));

const validFinal: FinalEvaluationOutput = {
  overallEvaluation: "סיכום מבוסס מקורות.",
  commandAndInstructionReadiness: { recommendation: "needs_review", reasoning: "מבוסס עדות." },
  commanderNotes: ["דגש קונקרטי"],
  evidenceGaps: ["אין מידע על הובלת קבוצה"],
  sourceFeedbackIds: ["f1"],
};
check("valid final_evaluation passes validation", validateTaskOutput("final_evaluation", validFinal).length, 0);
check(
  "bad recommendation rejected",
  validateTaskOutput("final_evaluation", { ...validFinal, commandAndInstructionReadiness: { recommendation: "yes", reasoning: "x" } }).length > 0,
  true,
);
check("missing overallEvaluation rejected", validateTaskOutput("final_evaluation", { ...validFinal, overallEvaluation: "" }).length > 0, true);
{
  // No feedback → the draft must be able to declare missing evidence (never fabricate).
  const out = await mockProvider.run("final_evaluation", {}, ctxWith([]));
  ok("empty sources → still valid", out.status === "ok" && validateTaskOutput("final_evaluation", out.output).length === 0);
  ok("empty sources → evidenceGaps declared", out.status === "ok" && (out.output as FinalEvaluationOutput).evidenceGaps.length > 0);
  ok("empty sources → recommendation insufficient_information", out.status === "ok" && (out.output as FinalEvaluationOutput).commandAndInstructionReadiness.recommendation === "insufficient_information");
}
{
  // sourceFeedbackIds reflect exactly the sources sent (traceability).
  const out = await mockProvider.run("final_evaluation", {}, ctxWith([
    { id: "f1", rawText: "אלפא", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "f2", rawText: "בטא", createdAt: "2026-01-02T00:00:00.000Z" },
  ]));
  check("sourceFeedbackIds match the sent sources", out.status === "ok" ? (out.output as FinalEvaluationOutput).sourceFeedbackIds : [], ["f1", "f2"]);
}

/* --- 7. trainee_overview (the aggregated "סקירה") ------------------------ */
console.log("\ntrainee_overview (aggregated review)\n");
ok("trainee_overview is an AI task", isAITask("trainee_overview"));
ok("trainee_overview is an artifact task (supersede/stale like others)", isAIArtifactTask("trainee_overview"));
{
  const empty = await mockProvider.run("trainee_overview", {}, ctxWith([]));
  ok("overview (no sources) → valid", empty.status === "ok" && validateTaskOutput("trainee_overview", empty.output).length === 0);
  if (empty.status === "ok") {
    const o = empty.output as TraineeOverviewOutput;
    ok("overview (no sources) → timeline has no points", o.timeline.points.length === 0);
    ok("overview (no sources) → readiness insufficient_information", o.finalEvaluation.readiness.recommendation === "insufficient_information");
    ok("overview (no sources) → evidenceGaps declared", o.finalEvaluation.evidenceGaps.length > 0);
  }
  const withFb = await mockProvider.run("trainee_overview", {}, ctxWith([
    { id: "f1", rawText: "אלפא", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "f2", rawText: "בטא", createdAt: "2026-01-02T00:00:00.000Z" },
  ]));
  ok("overview (with sources) → valid", withFb.status === "ok" && validateTaskOutput("trainee_overview", withFb.output).length === 0);
  if (withFb.status === "ok") {
    const o = withFb.output as TraineeOverviewOutput;
    check("overview sourceFeedbackIds trace the sent sources", o.sourceFeedbackIds, ["f1", "f2"]);
    ok("overview timeline is chronological", o.timeline.points.length === 2 && o.timeline.points[0].at <= o.timeline.points[1].at);
  }
  // Structured task → the real provider requests json_schema.
  const validOverview: TraineeOverviewOutput = {
    snapshot: "תמצית",
    trends: [],
    strengths: ["א"],
    gaps: ["ב"],
    focus: ["ג"],
    timeline: { points: [] },
    finalEvaluation: {
      overallEvaluation: "ס",
      readiness: { recommendation: "needs_review", reasoning: "ר" },
      commanderNotes: [],
      evidenceGaps: [],
    },
    sourceFeedbackIds: ["f1"],
  };
  const { client, captured } = fakeClient({ text: JSON.stringify(validOverview) });
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client });
  const res = await provider.run("trainee_overview", {}, ctxWith([{ id: "f1", rawText: "אלפא", createdAt: "2026-01-01T00:00:00.000Z" }]));
  ok("overview structured run ok", res.status === "ok");
  const fmt = (captured.params?.text as { format?: { type?: string } })?.format;
  check("overview requests json_schema", fmt?.type, "json_schema");
}

/* --- 8. trainee_file_extract (import) ------------------------------------ */
console.log("\ntrainee_file_extract (import extraction)\n");
ok("trainee_file_extract is an AI task", isAITask("trainee_file_extract"));
ok("trainee_file_extract is NOT an artifact task (nothing persisted)", !isAIArtifactTask("trainee_file_extract"));
check(
  "extract accepts null fields + missingFields",
  validateTaskOutput("trainee_file_extract", {
    fullName: null, team: null, strengths: [], weaknesses: [], notes: null, suggestedCohortName: null, missingFields: ["fullName"],
  }).length,
  0,
);
ok(
  "extract rejects non-string fullName (never a fabricated type)",
  validateTaskOutput("trainee_file_extract", {
    fullName: 5, team: null, strengths: [], weaknesses: [], notes: null, suggestedCohortName: null, missingFields: [],
  }).length > 0,
);
{
  const validExtract = { fullName: "אלון", team: null, strengths: [], weaknesses: [], notes: null, suggestedCohortName: null, missingFields: [] };
  const { client, captured } = fakeClient({ text: JSON.stringify(validExtract) });
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client });
  // ctx carries feedback + trainee, but extraction must send NEITHER — only the doc text.
  const ctx = ctxWith([{ id: "f1", rawText: "משוב-לא-רלוונטי", createdAt: "2026-01-01T00:00:00.000Z" }]);
  const res = await provider.run("trainee_file_extract", { text: "אלון כהן\nפרטי מסמך" }, ctx);
  ok("extract run ok", res.status === "ok");
  const input = String(captured.params?.input ?? "");
  ok("document text is present in the prompt", input.includes("אלון כהן"));
  ok("no feedback/trainee context leaks into the extraction prompt", !input.includes("משוב-לא-רלוונטי") && !input.includes("פרופיל החניך"));
  const fmt = (captured.params?.text as { format?: { type?: string } })?.format;
  check("extraction requests json_schema", fmt?.type, "json_schema");
}
{
  const provider = createOpenAIProvider({ apiKey: API_KEY, model: MODEL, client: fakeClient({ text: "{}" }).client });
  const empty = await provider.run("trainee_file_extract", { text: "" }, ctxWith([]));
  ok("empty extraction text → invalid_output (no empty AI request)", empty.status === "error" && empty.category === "invalid_output");
  const big = await provider.run("trainee_file_extract", { text: "א".repeat(60_001) }, ctxWith([]));
  ok("oversized document → input_too_large", big.status === "error" && big.category === "input_too_large");
}

console.log(failures === 0 ? "\n✓ all openai/final_evaluation checks passed" : `\n✗ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("check-openai failed to run:", err);
  process.exit(1);
});
