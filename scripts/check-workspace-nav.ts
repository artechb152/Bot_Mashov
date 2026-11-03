/**
 * Pure checks for Stage 4 (entry redirects + cohort navigation). No DB, no server —
 * run via tsx, like scripts/check-admin-guards.ts.
 *
 * Covers the invariants that must never regress:
 *   1. safeNextPath — post-login target defaults to the work area, "/" never sticks,
 *      and open-redirects are rejected.
 *   2. pickActiveCohort — the cohort the work area opens on (request → default →
 *      assignment → most-recent → unassigned → none), never a cohort not available.
 *   3. traineeMatchesCohort — cohort filtering (all / unassigned bucket / specific).
 *
 * Run:  npx tsx scripts/check-workspace-nav.ts   (or: npm run check:workspace)
 */
import { safeNextPath } from "@/lib/auth/safe-next";
import { NO_COHORT, pickActiveCohort, traineeMatchesCohort } from "@/lib/workspace/nav";

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

/* --- 1. safeNextPath ----------------------------------------------------- */
console.log("\nsafeNextPath\n");
check("undefined → /workspace", safeNextPath(undefined), "/workspace");
check("'/' → /workspace (never bounce to entry)", safeNextPath("/"), "/workspace");
check("valid same-origin path kept", safeNextPath("/trainees/123"), "/trainees/123");
check("protocol-relative rejected", safeNextPath("//evil.example"), "/workspace");
check("backslash rejected", safeNextPath("/\\evil"), "/workspace");
check("non-absolute rejected", safeNextPath("evil.example"), "/workspace");
check("custom fallback honored for entry page", safeNextPath(undefined, "/"), "/");

/* --- 2. pickActiveCohort ------------------------------------------------- */
console.log("\npickActiveCohort\n");
const AVAIL = ["c3", "c2", "c1"]; // most-recent-first
check("valid request wins", pickActiveCohort({ requested: "c2", defaultId: "c1", assignmentId: "c3", available: AVAIL, hasUnassigned: false }), "c2");
check("unknown request → falls through to default", pickActiveCohort({ requested: "ghost", defaultId: "c1", assignmentId: "c3", available: AVAIL, hasUnassigned: false }), "c1");
check("default when no request", pickActiveCohort({ defaultId: "c2", assignmentId: "c3", available: AVAIL, hasUnassigned: false }), "c2");
check("stale default → assignment", pickActiveCohort({ defaultId: "gone", assignmentId: "c3", available: AVAIL, hasUnassigned: false }), "c3");
check("no default/assignment → most recent", pickActiveCohort({ available: AVAIL, hasUnassigned: false }), "c3");
check("unassigned request honored when it has content", pickActiveCohort({ requested: NO_COHORT, available: AVAIL, hasUnassigned: true }), NO_COHORT);
check("unassigned request ignored when empty → most recent", pickActiveCohort({ requested: NO_COHORT, available: AVAIL, hasUnassigned: false }), "c3");
check("nothing available but unassigned exists → unassigned", pickActiveCohort({ available: [], hasUnassigned: true }), NO_COHORT);
check("nothing at all → null", pickActiveCohort({ available: [], hasUnassigned: false }), null);

/* --- 3. traineeMatchesCohort --------------------------------------------- */
console.log("\ntraineeMatchesCohort\n");
ok("no filter (null) shows all", traineeMatchesCohort("c1", null));
ok("no filter shows unassigned too", traineeMatchesCohort(null, null));
ok("unassigned bucket matches null cohort", traineeMatchesCohort(null, NO_COHORT));
ok("unassigned bucket excludes assigned", !traineeMatchesCohort("c1", NO_COHORT));
ok("specific cohort matches", traineeMatchesCohort("c1", "c1"));
ok("specific cohort excludes others", !traineeMatchesCohort("c2", "c1"));
ok("specific cohort excludes unassigned", !traineeMatchesCohort(null, "c1"));

console.log(failures === 0 ? "\n✓ all workspace-nav checks passed" : `\n✗ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
