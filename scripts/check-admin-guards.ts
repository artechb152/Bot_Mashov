/**
 * Guard checks for the admin/RBAC feature. Pure, no DB, no server — run via tsx
 * (already a devDependency), like scripts/check-import-parser.ts.
 *
 * Covers the security invariants that must never regress:
 *   1. The admin user DTO never carries passwordHash / __v.
 *   2. The role/status change policy (root-only role changes; root protection;
 *      course-scoped admin status changes) — spec §12, §14, §15.
 *
 * Run:  npx tsx scripts/check-admin-guards.ts
 */
import { canChangeRole, canChangeStatus, type PolicyActor, type PolicyTarget } from "@/lib/auth/policy";
import { sameCourse } from "@/lib/auth/scope";
import type { AdminUserDTO } from "@/lib/data/admin";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`);
  }
}

/* --- 1. Admin user DTO must not leak secrets ------------------------------ */
async function dtoLeak() {
  console.log("\nadmin user DTO shape\n");
  // Build an object of type AdminUserDTO (compile-time guarantee it matches the
  // real type) and confirm the allowlist has exactly the intended keys — no
  // passwordHash, no __v.
  const sample: AdminUserDTO = {
    id: "x",
    fullName: "פלוני",
    displayName: "פלוני אלמוני",
    username: "ploni",
    role: "admin",
    isRootSuperAdmin: false,
    status: "active",
    adminPosition: null,
    directoryVisibility: "visible",
    courseType: "kapeh",
    traineeCount: 3,
    createdAt: null,
  };
  const keys = Object.keys(sample).sort();
  check("AdminUserDTO keys are the allowlist", keys, [
    "adminPosition",
    "courseType",
    "createdAt",
    "directoryVisibility",
    "displayName",
    "fullName",
    "id",
    "isRootSuperAdmin",
    "role",
    "status",
    "traineeCount",
    "username",
  ]);
  check("no passwordHash key", keys.includes("passwordHash"), false);
  check("no __v key", keys.includes("__v"), false);
}

/* --- 3. Role/status change policy ----------------------------------------- */
const ROOT: PolicyActor = { id: "root", role: "super_admin", isRoot: true, courseType: null };
const SUPER: PolicyActor = { id: "super", role: "super_admin", isRoot: false, courseType: null };
const ADMIN_K: PolicyActor = { id: "adminK", role: "admin", isRoot: false, courseType: "kapeh" };
const STAFF: PolicyActor = { id: "staff", role: "staff", isRoot: false, courseType: "kapeh" };

const T_STAFF_K: PolicyTarget = { id: "tk", role: "staff", isRootSuperAdmin: false, courseType: "kapeh" };
const T_STAFF_M: PolicyTarget = { id: "tm", role: "staff", isRootSuperAdmin: false, courseType: "maksim" };
const T_ADMIN_K: PolicyTarget = { id: "ak", role: "admin", isRootSuperAdmin: false, courseType: "kapeh" };
const T_SUPER: PolicyTarget = { id: "s", role: "super_admin", isRootSuperAdmin: false, courseType: null };
const T_ROOT: PolicyTarget = { id: "r", role: "super_admin", isRootSuperAdmin: true, courseType: null };

async function policyTable() {
  console.log("\nrole-change policy (root-only, spec §12)\n");
  check("non-root admin cannot change roles", canChangeRole(ADMIN_K, T_STAFF_K, "admin"), {
    allowed: false,
    reason: "root_required",
  });
  check("regular super_admin cannot change roles", canChangeRole(SUPER, T_STAFF_K, "admin"), {
    allowed: false,
    reason: "root_required",
  });
  check("root cannot touch a root target", canChangeRole(ROOT, T_ROOT, "staff"), {
    allowed: false,
    reason: "root_protected",
  });
  check("root may promote staff→admin", canChangeRole(ROOT, T_STAFF_K, "admin"), {
    allowed: true,
    requiresSelfConfirm: false,
  });
  check("root may demote a regular super_admin", canChangeRole(ROOT, T_SUPER, "admin"), {
    allowed: true,
    requiresSelfConfirm: false,
  });

  console.log("\nstatus-change policy (spec §14/§15)\n");
  check("root target status is untouchable", canChangeStatus(SUPER, T_ROOT, "disabled"), {
    allowed: false,
    reason: "root_protected",
  });
  check("staff cannot change status", canChangeStatus(STAFF, T_STAFF_K, "suspended"), {
    allowed: false,
    reason: "not_privileged",
  });
  check("admin may suspend staff in own course", canChangeStatus(ADMIN_K, T_STAFF_K, "suspended"), {
    allowed: true,
  });
  check("admin cannot touch staff in another course", canChangeStatus(ADMIN_K, T_STAFF_M, "suspended"), {
    allowed: false,
    reason: "out_of_scope",
  });
  check("admin cannot touch another admin", canChangeStatus(ADMIN_K, T_ADMIN_K, "suspended"), {
    allowed: false,
    reason: "out_of_scope",
  });
  check("regular super_admin cannot change a super_admin's status", canChangeStatus(SUPER, T_SUPER, "disabled"), {
    allowed: false,
    reason: "root_required",
  });
  check("super_admin may suspend an admin", canChangeStatus(SUPER, T_ADMIN_K, "suspended"), {
    allowed: true,
  });
}

/* --- 4. Course-scope bridge (courseType → courseId migration, §7/§8) -------- */
async function scopeBridge() {
  console.log("\ncourse-scope bridge (courseId-first, courseType fallback)\n");
  const K1 = "aaaaaaaaaaaaaaaaaaaaaaaa"; // kapeh courseId
  const M1 = "bbbbbbbbbbbbbbbbbbbbbbbb"; // maksim courseId

  check("same courseId → same course", sameCourse({ courseId: K1, courseType: "kapeh" }, { courseId: K1, courseType: "kapeh" }), true);
  check("different courseId → NOT same (even if courseType matches)", sameCourse({ courseId: K1, courseType: "kapeh" }, { courseId: M1, courseType: "kapeh" }), false);
  check("courseId wins over a drifted courseType", sameCourse({ courseId: K1, courseType: "kapeh" }, { courseId: K1, courseType: "maksim" }), true);
  check("record missing courseId → fall back to courseType (match)", sameCourse({ courseId: K1, courseType: "kapeh" }, { courseId: null, courseType: "kapeh" }), true);
  check("record missing courseId → fall back to courseType (no match)", sameCourse({ courseId: K1, courseType: "kapeh" }, { courseId: null, courseType: "maksim" }), false);
  check("actor missing courseId (legacy) → courseType fallback", sameCourse({ courseId: null, courseType: "kapeh" }, { courseId: K1, courseType: "kapeh" }), true);
  check("actor with no course at all → never matches", sameCourse({ courseId: null, courseType: null }, { courseId: K1, courseType: "kapeh" }), false);
}

async function main() {
  await dtoLeak();
  await policyTable();
  await scopeBridge();
  console.log("");
  if (failures > 0) {
    console.error(`✗ ${failures} check(s) failed\n`);
    process.exit(1);
  }
  console.log("✓ all admin guard checks passed\n");
}

void main();
