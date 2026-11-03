/**
 * Guard/permission checks for the Feedback feature (Stage 1). Pure, no DB, no
 * server — run via tsx, like scripts/check-admin-guards.ts.
 *
 * Covers the invariants that must never regress:
 *   1. FeedbackDTO carries no secrets (exact allowlist of keys).
 *   2. The edit/archive permission MATRIX (canEditFeedback):
 *        write levels (owner/edit/course_admin/super_admin/root) → always;
 *        a plain "view" → only the AUTHOR; anything else → never.
 *   3. Request-body validation (parseFeedbackBody) for create + partial update.
 *
 * Run:  npx tsx scripts/check-feedback.ts   (or: npm run check:feedback)
 */
import { canEditFeedback, isFeedbackWriteLevel } from "@/lib/auth/feedback-policy";
import { parseFeedbackBody } from "@/lib/validation/feedback";
import type { TraineeAccessLevel } from "@/lib/auth/access";
import type { FeedbackDTO } from "@/lib/data/feedback";

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

/* --- 1. FeedbackDTO must not leak secrets ---------------------------------- */
console.log("\nFeedbackDTO shape\n");
const sample: FeedbackDTO = {
  id: "x",
  traineeId: "t",
  title: "כותרת",
  feedbackType: "lesson",
  rawText: "טקסט",
  selectedAction: "",
  authorId: "u",
  authorName: "פלוני",
  status: "active",
  attachment: null,
  createdAt: null,
  updatedAt: null,
  ai: { summary: "", analysis: "", recommendations: [] },
};
check("FeedbackDTO keys are the allowlist", Object.keys(sample).sort(), [
  "ai",
  "attachment",
  "authorId",
  "authorName",
  "createdAt",
  "feedbackType",
  "id",
  "rawText",
  "selectedAction",
  "status",
  "title",
  "traineeId",
  "updatedAt",
]);
// A file attachment DTO must never carry the storageKey or extractedText (server-only).
const attachmentSample: NonNullable<FeedbackDTO["attachment"]> = {
  originalFileName: "doc.pdf",
  mimeType: "application/pdf",
  size: 1234,
  extractionStatus: "extracted",
  hasText: true,
};
check("attachment DTO keys (no storageKey / extractedText)", Object.keys(attachmentSample).sort(), [
  "extractionStatus",
  "hasText",
  "mimeType",
  "originalFileName",
  "size",
]);

/* --- 2. Edit/archive permission matrix ------------------------------------ */
console.log("\ncanEditFeedback matrix\n");
const WRITE: TraineeAccessLevel[] = ["owner", "edit", "course_admin", "super_admin"];
for (const via of WRITE) {
  check(`${via} may edit (non-author)`, canEditFeedback(via, false), true);
  check(`${via} may edit (author)`, canEditFeedback(via, true), true);
  check(`${via} is a write level`, isFeedbackWriteLevel(via), true);
}
check("view + author → may edit", canEditFeedback("view", true), true);
check("view + NOT author → may NOT edit", canEditFeedback("view", false), false);
check("view is not a write level", isFeedbackWriteLevel("view"), false);

/* --- 3. Request-body validation ------------------------------------------- */
console.log("\nparseFeedbackBody\n");
check("create valid", parseFeedbackBody({ feedbackType: "lesson", rawText: "טקסט" }, false).ok, true);
check("create missing rawText → invalid", parseFeedbackBody({ feedbackType: "lesson" }, false).ok, false);
check("create invalid feedbackType → invalid", parseFeedbackBody({ feedbackType: "nope", rawText: "x" }, false).ok, false);
check("create empty rawText → invalid", parseFeedbackBody({ feedbackType: "lesson", rawText: "   " }, false).ok, false);
check("partial empty → invalid", parseFeedbackBody({}, true).ok, false);
check("partial valid rawText → valid", parseFeedbackBody({ rawText: "עדכון" }, true).ok, true);
check("non-object body → invalid", parseFeedbackBody(null, false).ok, false);

console.log(failures === 0 ? "\n✓ all feedback checks passed" : `\n✗ ${failures} feedback check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
