/**
 * Guard/permission checks for Stage 2 (Conversations + TraineeAIInsight). Pure, no
 * DB, no server — run via tsx, like scripts/check-admin-guards.ts.
 *
 * Covers the invariants that must never regress:
 *   1. Conversation access policy (owner / authorized manager only).
 *   2. Source selection: cross-trainee/unknown ids are dropped; only ACTIVE +
 *      SELECTED feedback enters the context; archived never does; empty stays empty.
 *   3. Staleness rule (which artifacts a feedback change invalidates).
 *   4. contextHash changes when a source feedback changes.
 *   5. DTOs carry no secrets (exact key allowlists).
 *
 * Run:  npx tsx scripts/check-conversations.ts   (or: npm run check:conversations)
 */
import { canAccessConversation } from "@/lib/auth/conversation-policy";
import {
  allActiveIds,
  insightNeedsStale,
  sanitizeSelection,
  selectFeedbackForAI,
  type FeedbackForSelection,
} from "@/lib/ai/selection";
import { buildTraineeAIContext, computeContextHash } from "@/lib/ai/context";
import type { TraineeAccessLevel } from "@/lib/auth/access";
import type { AIFeedbackItem } from "@/lib/ai/types";
import type { ConversationDTO, TurnDTO } from "@/lib/data/conversations";
import type { InsightDTO } from "@/lib/data/ai-insights";

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

/* --- 1. Conversation access policy --------------------------------------- */
console.log("\ncanAccessConversation\n");
const conv = { ownerId: "owner1" };
ok("owner may access (any via)", canAccessConversation("owner1", "owner", conv));
ok("course_admin (non-owner) may access", canAccessConversation("other", "course_admin", conv));
ok("super_admin (non-owner) may access", canAccessConversation("other", "super_admin", conv));
ok("non-owner trainee-owner may NOT access", !canAccessConversation("other", "owner", conv));
ok("non-owner view grant may NOT access", !canAccessConversation("other", "view", conv));
ok("non-owner edit grant may NOT access", !canAccessConversation("other", "edit", conv));

/* --- 2. Source selection ------------------------------------------------- */
console.log("\nselection safety\n");
const items: FeedbackForSelection[] = [
  { id: "f2", feedbackType: "lesson", rawText: "ב", createdAt: "2026-01-02T00:00:00.000Z", status: "active" },
  { id: "f1", feedbackType: "lesson", rawText: "א", createdAt: "2026-01-01T00:00:00.000Z", status: "active" },
  { id: "f3", feedbackType: "lesson", rawText: "ג", createdAt: "2026-01-03T00:00:00.000Z", status: "archived" },
];
check("sanitize drops cross-trainee/unknown ids", sanitizeSelection(["f1", "f3", "ghost"], items), ["f1", "f3"]);
check("sanitize empty stays empty", sanitizeSelection([], items), []);
check("allActiveIds = active only", allActiveIds(items), ["f2", "f1"]);
check(
  "selectFeedbackForAI: active+selected, chronological",
  selectFeedbackForAI(items, ["f1", "f2", "f3"]).map((f) => f.id),
  ["f1", "f2"],
);
ok("archived-but-selected excluded from context", !selectFeedbackForAI(items, ["f3"]).some((f) => f.id === "f3"));
check("empty selection → empty context", selectFeedbackForAI(items, []).length, 0);
check("'all' selection = all active, chronological", selectFeedbackForAI(items, "all").map((f) => f.id), ["f1", "f2"]);

/* --- 3. Staleness rule --------------------------------------------------- */
console.log("\ninsightNeedsStale\n");
ok("new source (no id) → stale all", insightNeedsStale(["a", "b"]));
ok("changed source cited → stale", insightNeedsStale(["a", "b"], "a"));
ok("changed source NOT cited → not stale", !insightNeedsStale(["a", "b"], "z"));

/* --- 4. contextHash reacts to a source change ---------------------------- */
console.log("\ncontextHash staleness signal\n");
const mkCtx = (updatedAt: string) => {
  const fb: AIFeedbackItem[] = [{ id: "f1", feedbackType: "lesson", rawText: "x", createdAt: "2026-01-01T00:00:00.000Z", updatedAt }];
  return buildTraineeAIContext({
    systemPrompt: "SP",
    systemPromptVersion: "spv",
    knowledgeExcerpts: [],
    knowledgeVersion: "kv",
    trainee: { id: "t1", fullName: "x", courseType: "kapeh" },
    allFeedback: fb,
    selection: "all",
  });
};
ok("hash changes after a source's updatedAt changes", computeContextHash(mkCtx("2026-01-01T00:00:00.000Z")) !== computeContextHash(mkCtx("2026-02-01T00:00:00.000Z")));

/* --- 5. DTO allowlists (no secrets) -------------------------------------- */
console.log("\nDTO shapes\n");
const convDTO: ConversationDTO = {
  id: "c", traineeId: "t", ownerId: "o", title: "", selectedFeedbackIds: [],
  status: "active", lastMessageAt: null, createdAt: null, updatedAt: null,
};
check("ConversationDTO keys", Object.keys(convDTO).sort(), [
  "createdAt", "id", "lastMessageAt", "ownerId", "selectedFeedbackIds", "status", "title", "traineeId", "updatedAt",
]);
const turnDTO: TurnDTO = {
  id: "x", role: "assistant", taskType: null, content: "", structuredOutput: null, provider: "", model: "", createdAt: null,
};
check("TurnDTO keys", Object.keys(turnDTO).sort(), [
  "content", "createdAt", "id", "model", "provider", "role", "structuredOutput", "taskType",
]);
const insightDTO: InsightDTO = {
  id: "i", traineeId: "t", artifactType: "trainee_review", structuredOutput: null, sourceFeedbackIds: [],
  contextHash: "", provider: "", model: "", systemPromptVersion: "", knowledgeVersion: "",
  status: "current", staleAt: null, createdAt: null, updatedAt: null,
};
check("InsightDTO keys", Object.keys(insightDTO).sort(), [
  "artifactType", "contextHash", "createdAt", "id", "knowledgeVersion", "model", "provider",
  "sourceFeedbackIds", "staleAt", "status", "structuredOutput", "systemPromptVersion", "traineeId", "updatedAt",
]);

console.log(failures === 0 ? "\n✓ all conversation/insight checks passed" : `\n✗ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
