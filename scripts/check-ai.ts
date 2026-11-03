/**
 * Checks for the חונך+ AI layer (Stage 0). Pure, no DB, no network — run via tsx,
 * like scripts/check-admin-guards.ts.
 *
 * Covers the invariants that must never regress:
 *   1. Context builder includes ONLY the selected feedback (the core safety rule).
 *   2. Selection is chronological; absent ids are ignored, never fabricated.
 *   3. computeContextHash is deterministic and reflects the selection.
 *   4. The Mock Provider is deterministic and emits VALID structured output.
 *   5. The Null Provider reports "not_configured" (never a fake answer).
 *   6. The factory maps AI_PROVIDER → provider; runAITask validates output.
 *
 * Run:  npx tsx scripts/check-ai.ts   (or: npm run check:ai)
 */
import {
  buildTraineeAIContext,
  selectFeedbackForContext,
  computeContextHash,
  getAIProvider,
  runAITask,
  validateTaskOutput,
  AI_TASKS,
  type AIContext,
  type AIFeedbackItem,
  type AITraineeContext,
} from "@/lib/ai";
import { mockProvider } from "@/lib/ai/mock-provider";
import { nullProvider } from "@/lib/ai/null-provider";

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
function ok(name: string, cond: boolean): void {
  check(name, cond, true);
}

const trainee: AITraineeContext = { id: "t1", fullName: "אלון כהן", courseType: "kapeh", team: "צוות 2" };
const fb = (id: string, day: number, text: string): AIFeedbackItem => ({
  id,
  feedbackType: "lesson",
  rawText: text,
  createdAt: `2026-01-0${day}T10:00:00.000Z`,
});
// Deliberately out of order to prove chronological sorting.
const allFeedback = [fb("f2", 2, "שני"), fb("f1", 1, "ראשון"), fb("f3", 3, "שלישי")];

const baseCtx = {
  systemPrompt: "SP",
  systemPromptVersion: "spv",
  knowledgeExcerpts: ["K"],
  knowledgeVersion: "kv",
  trainee,
  allFeedback,
};

function makeCtx(selection: string[] | "all"): AIContext {
  return buildTraineeAIContext({ ...baseCtx, selection });
}

async function main() {
  console.log("\ncontext builder — selected feedback only\n");
  const ctxAll = makeCtx("all");
  check("'all' selection is chronological", ctxAll.feedback.map((f) => f.id), ["f1", "f2", "f3"]);

  const ctxSub = makeCtx(["f3", "f1", "does-not-exist"]);
  check("explicit selection keeps only selected, chronological", ctxSub.feedback.map((f) => f.id), ["f1", "f3"]);
  ok("unselected feedback (f2) is NOT in context", !ctxSub.feedback.some((f) => f.id === "f2"));
  ok("absent id is ignored (not fabricated)", ctxSub.feedback.length === 2);
  check("empty selection → empty context feedback", selectFeedbackForContext(allFeedback, []).length, 0);

  console.log("\ncontextHash — deterministic + selection-sensitive\n");
  ok("same context → same hash", computeContextHash(makeCtx("all")) === computeContextHash(makeCtx("all")));
  ok("different selection → different hash", computeContextHash(ctxAll) !== computeContextHash(ctxSub));

  console.log("\nMock Provider — deterministic + valid structured output\n");
  for (const task of AI_TASKS) {
    const input =
      task === "chat"
        ? { messages: [{ role: "user" as const, content: "שלום" }] }
        : task === "feedback_polish"
          ? { rawText: "הערה גולמית", feedbackType: "lesson" as const }
          : task === "trainee_file_extract"
            ? { text: "אלון כהן\nהערה על תפקוד בתרגיל" }
            : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r1 = await mockProvider.run(task as any, input as any, ctxAll);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r2 = await mockProvider.run(task as any, input as any, ctxAll);
    ok(`mock '${task}' is deterministic`, JSON.stringify(r1) === JSON.stringify(r2));
    ok(`mock '${task}' status ok`, r1.status === "ok");
    if (r1.status === "ok") check(`mock '${task}' output valid`, validateTaskOutput(task, r1.output), []);
  }

  console.log("\nNull Provider — never a fake answer\n");
  for (const task of AI_TASKS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await nullProvider.run(task as any, {} as any, ctxAll);
    check(`null '${task}' → not_configured`, r.status, "not_configured");
  }

  console.log("\nfactory + runAITask\n");
  delete process.env.AI_PROVIDER;
  ok("no env → null provider", getAIProvider().name === "null");
  process.env.AI_PROVIDER = "mock";
  ok("AI_PROVIDER=mock → mock provider", getAIProvider().name === "mock");
  const run = await runAITask("trainee_review", {}, ctxAll);
  ok("runAITask(mock) → ok", run.status === "ok");
  ok("runAITask(mock) carries contextHash", run.status === "ok" && typeof run.contextHash === "string" && run.contextHash.length > 0);
  delete process.env.AI_PROVIDER;
  const runNull = await runAITask("trainee_review", {}, ctxAll);
  check("runAITask(null) → not_configured", runNull.status, "not_configured");

  console.log("\nvalidators reject malformed output\n");
  ok("trainee_review missing summary → invalid", validateTaskOutput("trainee_review", { strengths: [] }).length > 0);
  ok("chat empty reply → invalid", validateTaskOutput("chat", { reply: "" }).length > 0);

  console.log(failures === 0 ? "\n✓ all AI checks passed" : `\n✗ ${failures} AI check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
