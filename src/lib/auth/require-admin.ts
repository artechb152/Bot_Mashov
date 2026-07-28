import { NextResponse } from "next/server";
import { getAccount, type Account } from "@/lib/auth/account";
import { isActive, inactiveResponse, unauthenticatedResponse } from "@/lib/auth/require-active";
import { isAdminRole, type CourseType } from "@/lib/domain/types";

/**
 * The management gate for every `/api/admin/*` (and later `/api/system/*`) handler
 * and the admin/system layouts — the sibling of `requireScope()` for the unscoped
 * management surface.
 *
 * It returns a BRANDED `AdminGrant`. The brand symbol is module-private and never
 * exported, so an `AdminGrant` value literally cannot be constructed anywhere
 * except here — a plain object is NOT assignable to it. The unscoped management
 * data layer (`src/lib/data/admin.ts`) accepts ONLY an `AdminGrant`, so those
 * all-users / all-trainees queries can never be called from a staff route.
 *
 * Both `admin` and `super_admin` satisfy this gate — the grant is GENERALIZED, not
 * forked. The difference is `courseScope`:
 *   - super_admin → `null` (GLOBAL, all courses).
 *   - admin       → `{ courseType, courseId }` (COURSE-BOUND). A `courseType` of
 *                   `null` means an admin with no course yet → matches nothing
 *                   (fail-closed) once the data layer honors the scope.
 *
 * Role + status are resolved fresh from the DB via `getAccount()` every call, so a
 * user demoted or suspended a moment ago is rejected immediately.
 */

declare const ADMIN_BRAND: unique symbol;

export type AdminCourseScope = {
  courseType: CourseType | null;
  courseId: string | null;
};

export type AdminGrant = {
  readonly adminId: string;
  readonly role: "admin" | "super_admin";
  readonly isRoot: boolean;
  /** null = GLOBAL (super_admin); set = course-bound (plain admin). */
  readonly courseScope: AdminCourseScope | null;
  readonly [ADMIN_BRAND]: true;
};

/** The ONLY constructor of an AdminGrant. Module-private on purpose. */
function makeGrant(account: Account): AdminGrant {
  const role = account.role === "super_admin" ? "super_admin" : "admin";
  const courseScope: AdminCourseScope | null =
    role === "super_admin"
      ? null
      : { courseType: account.courseType, courseId: account.courseId };
  return {
    adminId: account.id,
    role,
    isRoot: account.isRootSuperAdmin,
    courseScope,
  } as AdminGrant;
}

export type AdminResult =
  | { ok: true; grant: AdminGrant }
  | { ok: false; response: NextResponse };

function forbidden(): NextResponse {
  return NextResponse.json({ error: "אין הרשאת גישה." }, { status: 403 });
}

/** Active admin OR super_admin. */
export async function requireAdmin(): Promise<AdminResult> {
  const account = await getAccount();
  if (!account) return { ok: false, response: unauthenticatedResponse() };
  if (!isActive(account)) return { ok: false, response: inactiveResponse(account.status) };
  if (!isAdminRole(account.role)) return { ok: false, response: forbidden() };
  return { ok: true, grant: makeGrant(account) };
}

/** Active super_admin only — the grant is guaranteed `courseScope === null` (global). */
export async function requireSuperAdmin(): Promise<AdminResult> {
  const account = await getAccount();
  if (!account) return { ok: false, response: unauthenticatedResponse() };
  if (!isActive(account)) return { ok: false, response: inactiveResponse(account.status) };
  if (account.role !== "super_admin") return { ok: false, response: forbidden() };
  return { ok: true, grant: makeGrant(account) };
}
