import { cache } from "react";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  isAdminPosition,
  isCourseType,
  isDirectoryVisibility,
  isRootProfile,
  isUserRole,
  isUserStatus,
  type AdminPosition,
  type CourseType,
  type DirectoryVisibility,
  type RootProfile,
  type UserRole,
  type UserStatus,
} from "@/lib/domain/types";

/**
 * The authoritative, DB-fresh view of the signed-in user.
 *
 * The session cookie proves IDENTITY only (id + username). Privilege — role,
 * status, root protection, and course placement — is read from the database on
 * every request here, NOT trusted from the token. That is the whole point:
 *
 *   - A demoted/suspended user loses access on their very next request (the
 *     stateless 7-day JWT can't be revoked, so a privilege claim in it would
 *     linger for days).
 *   - A promoted user gains access on their next request, no re-login.
 *   - `role`/`status` are deliberately kept OFF `SessionUser`, so `user.role` is a
 *     compile error everywhere — nobody can accidentally authorize off the token.
 *
 * `cache()` (React per-request memo) dedupes this to a single DB read per render.
 * This function only READS the account; enforcement of `status` (blocking a
 * suspended/disabled user) lives in the grant constructors + login route, so a
 * suspended user still reaches a clear "account suspended" surface rather than an
 * infinite redirect — but no DATA gate ever passes them.
 *
 * Server-only (touches the DB and next/headers via getCurrentUser).
 */
export type Account = {
  id: string;
  username: string;
  courseType: CourseType | null;
  courseId: string | null;
  role: UserRole;
  isRootSuperAdmin: boolean;
  rootProfile: RootProfile | null;
  status: UserStatus;
  adminPosition: AdminPosition | null;
  directoryVisibility: DirectoryVisibility;
};

type LeanAccount = {
  _id: unknown;
  username?: string;
  courseType?: string | null;
  courseId?: unknown;
  role?: string | null;
  isRootSuperAdmin?: boolean | null;
  rootProfile?: string | null;
  status?: string | null;
  adminPosition?: string | null;
  directoryVisibility?: string | null;
};

export const getAccount = cache(async (): Promise<Account | null> => {
  const session = await getCurrentUser();
  if (!session) return null;

  await connectToDatabase();
  const doc = await User.findById(session.id)
    .select(
      "_id username courseType courseId role isRootSuperAdmin rootProfile status adminPosition directoryVisibility",
    )
    .lean<LeanAccount | null>();

  // Phantom user: a valid cookie for an account that no longer exists (e.g. the
  // DB was reset while the cookie lived on). Treat as logged-out.
  if (!doc) return null;

  // Default-deny: anything not exactly a known value is downgraded/fail-closed.
  const role: UserRole = isUserRole(doc.role) ? doc.role : "staff";
  // Source-of-truth invariant: a super_admin/root is GLOBAL and carries no course.
  // Enforce it at the authoritative read point so stale course fields on a legacy
  // super_admin row can never scope or (via the onboarding gate) prompt them.
  const isGlobal = role === "super_admin";

  return {
    id: String(doc._id),
    username: typeof doc.username === "string" ? doc.username : session.username,
    role,
    // Only a strict boolean true counts as root.
    isRootSuperAdmin: doc.isRootSuperAdmin === true,
    rootProfile: isRootProfile(doc.rootProfile) ? doc.rootProfile : null,
    // Missing status → "active": only pre-redesign legacy rows lack the field, and
    // they were never suspended (the schema defaults new rows to "active", and
    // suspend/disable always writes the field explicitly). Treating a legacy row as
    // active preserves existing access; an unrecognized non-empty value still
    // fails closed to "disabled".
    status: isUserStatus(doc.status)
      ? doc.status
      : doc.status == null
        ? "active"
        : "disabled",
    adminPosition: isAdminPosition(doc.adminPosition) ? doc.adminPosition : null,
    directoryVisibility: isDirectoryVisibility(doc.directoryVisibility)
      ? doc.directoryVisibility
      : "visible",
    courseType: isGlobal ? null : isCourseType(doc.courseType) ? doc.courseType : null,
    courseId: isGlobal ? null : doc.courseId ? String(doc.courseId) : null,
  };
});
