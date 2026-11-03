/**
 * Pure navigation checks: the management nav (AreaNav) is minimal, carries only
 * serializable data, and no longer contains removed features (access requests, cohort
 * management, trainee files, course overview, system messages). Run via tsx.
 *
 * RBAC of the underlying management APIs is covered by check:guards (role/status/scope
 * gates) — cohort mutations require requireAdmin + course scope; access-code creation
 * requires requireSuperAdmin.
 *
 * Run:  npx tsx scripts/check-nav.ts   (or: npm run check:nav)
 */
import { navForRole } from "@/lib/navigation";

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

console.log("\nnavForRole — management links by role\n");

const staff = navForRole("staff");
const admin = navForRole("admin");
const sup = navForRole("super_admin");

check("staff has no management links", staff.length, 0);
check("admin → users / trainees / people", admin.map((i) => i.href), [
  "/admin/users",
  "/admin/trainees",
  "/admin/people",
]);
check("super → users / trainees / people / codes / courses / logs", sup.map((i) => i.href), [
  "/system/users",
  "/system/trainees",
  "/system/people",
  "/system/invites",
  "/system/courses",
  "/system/audit",
]);
ok("super includes access codes label", sup.some((i) => i.label === "קודי גישה"));
ok("both roles include 'אנשי מערכת'", admin.some((i) => i.label === "אנשי מערכת") && sup.some((i) => i.label === "אנשי מערכת"));
ok("both roles include 'תיקי חניך'", admin.some((i) => i.label === "תיקי חניך") && sup.some((i) => i.label === "תיקי חניך"));
ok("admin does NOT get access codes", !admin.some((i) => i.href === "/admin/invites" || i.label === "קודי גישה"));

const all = [...staff, ...admin, ...sup];
ok("no 'access requests' anywhere", !all.some((i) => i.href.includes("/requests") || i.label.includes("בקשות")));
ok("no cohort-management page in nav", !all.some((i) => i.href.includes("/cohorts") || i.label.includes("מחזור")));
ok("no course-overview page in nav", !all.some((i) => i.href === "/admin" || i.href === "/system"));
ok("no system-messages page in nav", !all.some((i) => i.href.includes("/notifications") || i.href.includes("/messages") || i.label.includes("הודעות")));
ok("every iconKey is a serializable string (no components)", all.every((i) => typeof i.iconKey === "string"));

console.log(failures === 0 ? "\n✓ all navigation checks passed" : `\n✗ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
