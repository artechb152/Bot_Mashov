import { isAdminRole, type CourseType, type UserRole, type UserStatus } from "@/lib/domain/types";

/**
 * Pure authorization POLICY — no DB, no I/O, fully unit-testable (see
 * `scripts/check-admin-guards.ts`). These functions decide LEGALITY only; the
 * data layer additionally enforces live invariants that need a query (e.g. "not
 * the last active manager").
 *
 * Precedence is fail-closed and root-protection always comes first: a protected
 * root account is immutable via any API, full stop.
 */

export type PolicyActor = {
  id: string;
  role: UserRole;
  isRoot: boolean;
  courseType: CourseType | null;
};

export type PolicyTarget = {
  id: string;
  role: UserRole;
  isRootSuperAdmin: boolean;
  courseType: CourseType | null;
};

export type DenyReason = "not_privileged" | "root_protected" | "root_required" | "out_of_scope";

export type RoleChangeVerdict =
  | { allowed: true; requiresSelfConfirm: boolean }
  | { allowed: false; reason: DenyReason };

export type StatusChangeVerdict =
  | { allowed: true }
  | { allowed: false; reason: DenyReason };

/** Demoting a user OUT of a management role (admin/super_admin → staff). */
function isDemotionOutOfManagement(current: UserRole, next: UserRole): boolean {
  return isAdminRole(current) && !isAdminRole(next);
}

/**
 * May `actor` change `target`'s role to `nextRole`? Direct role management is
 * ROOT-ONLY (spec §12). (Staff→admin can also happen via an approved
 * admin_role_request — a separate, super-admin-reviewed flow — not this function.)
 */
export function canChangeRole(
  actor: PolicyActor,
  target: PolicyTarget,
  _nextRole: UserRole,
): RoleChangeVerdict {
  // 1. A protected root account can never be changed via any API.
  if (target.isRootSuperAdmin) return { allowed: false, reason: "root_protected" };
  // 2. Only a root super-admin may change roles directly.
  if (!actor.isRoot) return { allowed: false, reason: "root_required" };
  // 3. Self-demotion out of a management role needs explicit confirmation.
  const requiresSelfConfirm =
    actor.id === target.id && isDemotionOutOfManagement(target.role, _nextRole);
  return { allowed: true, requiresSelfConfirm };
}

/**
 * May `actor` change `target`'s account status?
 *   - Root targets are never touchable.
 *   - Changing a super_admin's status requires root.
 *   - A super_admin may change admin/staff status globally.
 *   - A plain admin may change only STAFF status, and only within their own course.
 */
export function canChangeStatus(
  actor: PolicyActor,
  target: PolicyTarget,
  _nextStatus: UserStatus,
): StatusChangeVerdict {
  if (target.isRootSuperAdmin) return { allowed: false, reason: "root_protected" };
  if (!isAdminRole(actor.role)) return { allowed: false, reason: "not_privileged" };
  // Only root may change a (regular) super_admin's status.
  if (target.role === "super_admin" && !actor.isRoot) {
    return { allowed: false, reason: "root_required" };
  }
  // A plain admin is course-bound and may act on staff only.
  if (actor.role === "admin" && !actor.isRoot) {
    if (target.role !== "staff") return { allowed: false, reason: "out_of_scope" };
    if (!actor.courseType || actor.courseType !== target.courseType) {
      return { allowed: false, reason: "out_of_scope" };
    }
  }
  return { allowed: true };
}
