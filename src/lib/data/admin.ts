import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Team, Trainee, TraineeAttachment, User } from "@/models";
import { readBufferField, type AttachmentDTO } from "@/lib/data/attachments";
import type { TraineeDTO, TraineeInput } from "@/lib/data/trainees";
import type { AdminGrant } from "@/lib/auth/require-admin";
import type { RootGrant } from "@/lib/auth/require-root";
import { courseScopeQuery, sameCourse } from "@/lib/auth/scope";
import {
  canChangeRole,
  canChangeStatus,
  type DenyReason,
  type PolicyActor,
  type PolicyTarget,
} from "@/lib/auth/policy";
import { writeAudit } from "@/lib/data/audit";
import { notify } from "@/lib/data/notifications";
import {
  ADMIN_ROLES,
  isAdminPosition,
  isAdminRole,
  isCourseType,
  isDirectoryVisibility,
  isUserRole,
  isUserStatus,
  type AdminPosition,
  type CourseType,
  type DirectoryVisibility,
  type UserRole,
  type UserStatus,
} from "@/lib/domain/types";

/**
 * Admin/super-admin data access. Every function requires an `AdminGrant`, whose
 * brand makes it impossible to construct outside `require-admin.ts` (which re-reads
 * role + status from the DB) — so these can never be reached from a staff route.
 *
 * The grant is now COURSE-SCOPED:
 *   - super_admin (grant.courseScope === null) → GLOBAL (all users/courses).
 *   - admin       (grant.courseScope set)      → their course only. Every query
 *     below adds the course filter, so a plain admin can never read or write
 *     another course's users, trainees, or attachments even by changing an id in
 *     a URL (the row simply does not match → null/empty → 404).
 *
 * Writes stay surgical. `adminUpdateTrainee` `$set`s only content fields, never
 * `commanderId`/`courseType`; ownership changes go through `transferTraineeOwnership`.
 *
 * Server-only.
 */

/**
 * Course filter for User/Trainee/Attachment. courseId-first with a courseType
 * fallback for legacy records (see `courseScopeQuery`). This is the fix for the
 * admin course-user under-count: a staff member whose legacy `courseType` drifted
 * but whose `courseId` is correct now matches their course admin's scope.
 */
function courseScopeFilter(grant: AdminGrant): Record<string, unknown> {
  return courseScopeQuery(grant);
}

/** Course filter for Cohort/Team (always keyed on courseId — these models predate courseType). */
function courseIdScopeFilter(grant: AdminGrant): Record<string, unknown> {
  if (!grant.courseScope) return {};
  const cid = grant.courseScope.courseId;
  return cid ? { courseId: new Types.ObjectId(cid) } : { _id: { $exists: false } };
}

/** The user-list filter: a plain admin sees only STAFF in their course (courseId-first). */
function userListFilter(grant: AdminGrant): Record<string, unknown> {
  if (!grant.courseScope) return {}; // super_admin — all users
  return { ...courseScopeQuery(grant), role: "staff" };
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                    */
/* -------------------------------------------------------------------------- */

export type AdminOverview = {
  staffCount: number;
  traineeCount: number;
  attachmentCount: number;
  cohortsActive: number;
  cohortsArchived: number;
  teamCount: number;
};

export async function adminOverview(grant: AdminGrant): Promise<AdminOverview> {
  await connectToDatabase();
  const userScope = courseScopeFilter(grant);
  const idScope = courseIdScopeFilter(grant);
  const [staffCount, traineeCount, attachmentCount, cohortsActive, cohortsArchived, teamCount] =
    await Promise.all([
      User.countDocuments({ ...userScope, role: "staff" }),
      Trainee.countDocuments(userScope),
      TraineeAttachment.countDocuments(userScope),
      Cohort.countDocuments({ ...idScope, status: "active" }),
      Cohort.countDocuments({ ...idScope, status: "archived" }),
      Team.countDocuments({ ...idScope, isActive: { $ne: false } }),
    ]);
  return { staffCount, traineeCount, attachmentCount, cohortsActive, cohortsArchived, teamCount };
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Admin view of a user. Built with a POSITIVE allowlist projection + explicit
 * field mapping, so `passwordHash` (and any future secret field) can NEVER reach
 * the client. Never return a raw Mongoose doc from this module.
 */
export type AdminUserDTO = {
  id: string;
  fullName: string;
  displayName: string;
  username: string;
  role: UserRole;
  isRootSuperAdmin: boolean;
  status: UserStatus;
  adminPosition: AdminPosition | null;
  directoryVisibility: DirectoryVisibility;
  courseType: CourseType | null;
  traineeCount: number;
  createdAt: string | null;
};

type LeanUser = {
  _id: unknown;
  fullName?: string;
  displayName?: string;
  username?: string;
  role?: string | null;
  isRootSuperAdmin?: boolean | null;
  status?: string | null;
  adminPosition?: string | null;
  directoryVisibility?: string | null;
  courseType?: string | null;
  createdAt?: Date | string;
};

function serializeUser(doc: LeanUser, traineeCount: number): AdminUserDTO {
  return {
    id: String(doc._id),
    fullName: doc.fullName ?? "",
    displayName: doc.displayName ?? doc.fullName ?? doc.username ?? "",
    username: doc.username ?? "",
    role: isUserRole(doc.role) ? doc.role : "staff",
    isRootSuperAdmin: doc.isRootSuperAdmin === true,
    status: isUserStatus(doc.status) ? doc.status : "active",
    adminPosition: isAdminPosition(doc.adminPosition) ? doc.adminPosition : null,
    directoryVisibility: isDirectoryVisibility(doc.directoryVisibility)
      ? doc.directoryVisibility
      : "visible",
    courseType: isCourseType(doc.courseType) ? doc.courseType : null,
    traineeCount,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

/** The exact positive projection used for every admin User read. No passwordHash. */
const USER_PROJECTION =
  "_id fullName displayName username role isRootSuperAdmin status adminPosition directoryVisibility courseType createdAt";

export async function listAllUsers(grant: AdminGrant): Promise<AdminUserDTO[]> {
  await connectToDatabase();
  // Hidden accounts (the project-owner ghost) never appear in listings unless the
  // viewer is root — visibility affects listing only, never authorization/audit.
  const hidden = grant.isRoot ? {} : { directoryVisibility: { $ne: "hidden" } };
  const filter = { ...userListFilter(grant), ...hidden };
  const [users, counts] = await Promise.all([
    User.find(filter).select(USER_PROJECTION).sort({ createdAt: -1, _id: -1 }).lean<LeanUser[]>(),
    Trainee.aggregate<{ _id: unknown; n: number }>([
      ...(Object.keys(courseScopeFilter(grant)).length ? [{ $match: courseScopeFilter(grant) }] : []),
      { $group: { _id: "$commanderId", n: { $sum: 1 } } },
    ]),
  ]);
  const countByUser = new Map(counts.map((c) => [String(c._id), c.n]));
  return users.map((u) => serializeUser(u, countByUser.get(String(u._id)) ?? 0));
}

export async function getAdminUser(grant: AdminGrant, userId: string): Promise<AdminUserDTO | null> {
  if (!isValidObjectId(userId)) return null;
  await connectToDatabase();
  // Combine id + scope in one query — an out-of-course user resolves to null (404).
  // User-FILE matrix (§20): a plain admin is already limited to same-course staff by
  // userListFilter. A NON-root super_admin may open staff/admin files in any course
  // but NOT another super_admin's management file and NOT a hidden account; root has
  // no such restriction. The row simply doesn't match → null → 404 (no probing).
  const fileScope: Record<string, unknown> = {};
  if (!grant.courseScope && !grant.isRoot) {
    fileScope.role = { $ne: "super_admin" };
    fileScope.directoryVisibility = { $ne: "hidden" };
  }
  const [user, traineeCount] = await Promise.all([
    User.findOne({ _id: userId, ...userListFilter(grant), ...fileScope }).select(USER_PROJECTION).lean<LeanUser | null>(),
    Trainee.countDocuments({ commanderId: userId }),
  ]);
  return user ? serializeUser(user, traineeCount) : null;
}

/* -------------------------------------------------------------------------- */
/* Trainees (any owner, any course)                                            */
/* -------------------------------------------------------------------------- */

type LeanTrainee = {
  _id: unknown;
  commanderId?: unknown;
  fullName?: string;
  courseType?: string;
  team?: string;
  strengths?: string[];
  weaknesses?: string[];
  notes?: string;
  status?: string;
  cohortId?: unknown;
  teamId?: unknown;
  cohortLocked?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

/** Admin trainee view — the staff `TraineeDTO` plus who owns it. */
export type AdminTraineeDTO = TraineeDTO & { ownerId: string };

function serializeTrainee(doc: LeanTrainee): AdminTraineeDTO {
  return {
    id: String(doc._id),
    ownerId: String(doc.commanderId ?? ""),
    fullName: doc.fullName ?? "",
    courseType: doc.courseType as CourseType,
    team: doc.team ?? "",
    strengths: Array.isArray(doc.strengths) ? doc.strengths : [],
    weaknesses: Array.isArray(doc.weaknesses) ? doc.weaknesses : [],
    notes: doc.notes ?? "",
    status: doc.status === "archived" ? "archived" : "active",
    cohortId: doc.cohortId ? String(doc.cohortId) : null,
    teamId: doc.teamId ? String(doc.teamId) : null,
    cohortLocked: doc.cohortLocked === true,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export async function listTraineesForUser(
  grant: AdminGrant,
  userId: string,
): Promise<AdminTraineeDTO[]> {
  if (!isValidObjectId(userId)) return [];
  await connectToDatabase();
  const docs = await Trainee.find({ commanderId: userId, ...courseScopeFilter(grant) })
    .sort({ createdAt: -1, _id: -1 })
    .lean<LeanTrainee[]>();
  return docs.map(serializeTrainee);
}

export async function listAllTrainees(
  grant: AdminGrant,
  filter: { cohortId?: string; teamId?: string; status?: "active" | "archived" } = {},
): Promise<AdminTraineeDTO[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = { ...courseScopeFilter(grant) };
  if (filter.cohortId && isValidObjectId(filter.cohortId)) q.cohortId = new Types.ObjectId(filter.cohortId);
  if (filter.teamId && isValidObjectId(filter.teamId)) q.teamId = new Types.ObjectId(filter.teamId);
  if (filter.status) q.status = filter.status;
  const docs = await Trainee.find(q).sort({ createdAt: -1, _id: -1 }).lean<LeanTrainee[]>();
  return docs.map(serializeTrainee);
}

export async function adminGetTrainee(
  grant: AdminGrant,
  traineeId: string,
): Promise<AdminTraineeDTO | null> {
  if (!isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  const doc = await Trainee.findOne({ _id: traineeId, ...courseScopeFilter(grant) }).lean<LeanTrainee | null>();
  return doc ? serializeTrainee(doc) : null;
}

/**
 * Edit a trainee's CONTENT (within scope). `patch` is `Partial<TraineeInput>` — so
 * `commanderId`/`courseType` are structurally un-settable here. Ownership changes go
 * through `transferTraineeOwnership`.
 */
export async function adminUpdateTrainee(
  grant: AdminGrant,
  traineeId: string,
  patch: Partial<TraineeInput>,
): Promise<AdminTraineeDTO | null> {
  if (!isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  const doc = await Trainee.findOneAndUpdate(
    { _id: traineeId, ...courseScopeFilter(grant) },
    { $set: { ...patch, lastUpdatedBy: new Types.ObjectId(grant.adminId) } },
    { new: true, runValidators: true },
  ).lean<LeanTrainee | null>();
  return doc ? serializeTrainee(doc) : null;
}

/* -------------------------------------------------------------------------- */
/* Attachments (any owner, any course)                                         */
/* -------------------------------------------------------------------------- */

type LeanAttachment = {
  _id: unknown;
  originalName?: string;
  mimeType?: string;
  size?: number;
  content?: Buffer;
  uploadedAt?: Date | string;
  createdAt?: Date | string;
};

function serializeAttachment(doc: LeanAttachment): AttachmentDTO {
  const when = doc.uploadedAt ?? doc.createdAt ?? null;
  return {
    id: String(doc._id),
    originalName: doc.originalName ?? "",
    mimeType: doc.mimeType ?? "application/octet-stream",
    size: typeof doc.size === "number" ? doc.size : 0,
    uploadedAt: when ? new Date(when).toISOString() : null,
  };
}

export async function adminListAttachments(
  grant: AdminGrant,
  traineeId: string,
): Promise<AttachmentDTO[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const docs = await TraineeAttachment.find({ traineeId, ...courseScopeFilter(grant) })
    .select("-content")
    .sort({ createdAt: -1, _id: -1 })
    .lean<LeanAttachment[]>();
  return docs.map(serializeAttachment);
}

export async function adminGetAttachment(
  grant: AdminGrant,
  traineeId: string,
  attachmentId: string,
): Promise<{ originalName: string; mimeType: string; content: Buffer } | null> {
  if (!isValidObjectId(traineeId) || !isValidObjectId(attachmentId)) return null;
  await connectToDatabase();
  // Keep the traineeId term (prevents the historical attId-swap IDOR) AND the
  // course scope (a plain admin can't read another course's attachment).
  const doc = await TraineeAttachment.findOne({
    _id: attachmentId,
    traineeId,
    ...courseScopeFilter(grant),
  }).lean<LeanAttachment | null>();
  if (!doc || !doc.content) return null;
  return {
    originalName: doc.originalName ?? "attachment",
    mimeType: doc.mimeType ?? "application/octet-stream",
    content: readBufferField(doc.content),
  };
}

export async function adminDeleteAttachment(
  grant: AdminGrant,
  traineeId: string,
  attachmentId: string,
): Promise<boolean> {
  if (!isValidObjectId(traineeId) || !isValidObjectId(attachmentId)) return false;
  await connectToDatabase();
  const res = await TraineeAttachment.findOneAndDelete({
    _id: attachmentId,
    traineeId,
    ...courseScopeFilter(grant),
  })
    .select("_id")
    .lean();
  return Boolean(res);
}

/* -------------------------------------------------------------------------- */
/* Role & status editing (guarded)                                             */
/* -------------------------------------------------------------------------- */

export type SetRoleReason = "not_found" | "last_admin" | "self_needs_confirm" | DenyReason;

export type SetRoleResult =
  | { ok: true; user: AdminUserDTO }
  | { ok: false; reason: SetRoleReason };

function toPolicyTarget(target: LeanUser): PolicyTarget {
  return {
    id: String(target._id),
    role: isUserRole(target.role) ? target.role : "staff",
    isRootSuperAdmin: target.isRootSuperAdmin === true,
    courseType: isCourseType(target.courseType) ? target.courseType : null,
  };
}

/**
 * Change a user's role. ROOT-ONLY (`RootGrant`) — spec §12. Legality is decided by
 * the pure `canChangeRole` policy (root target immutable; only root may change
 * roles; self-demotion confirm). The live "last active manager" invariant needs a
 * DB count, so it is enforced here. Every applied change is audited. There is no
 * user-deletion path anywhere.
 */
export async function adminSetUserRole(
  grant: RootGrant,
  userId: string,
  nextRole: UserRole,
  opts: { confirmSelf?: boolean } = {},
): Promise<SetRoleResult> {
  if (!isValidObjectId(userId)) return { ok: false, reason: "not_found" };
  await connectToDatabase();

  const target = await User.findById(userId).select(USER_PROJECTION).lean<LeanUser | null>();
  if (!target) return { ok: false, reason: "not_found" };

  const currentRole: UserRole = isUserRole(target.role) ? target.role : "staff";
  const actor: PolicyActor = { id: grant.rootId, role: "super_admin", isRoot: true, courseType: null };
  const verdict = canChangeRole(actor, toPolicyTarget(target), nextRole);
  if (!verdict.allowed) return { ok: false, reason: verdict.reason };

  // No-op: already the requested role.
  if (currentRole === nextRole) {
    const count = await Trainee.countDocuments({ commanderId: userId });
    return { ok: true, user: serializeUser(target, count) };
  }

  if (verdict.requiresSelfConfirm && !opts.confirmSelf) {
    return { ok: false, reason: "self_needs_confirm" };
  }

  // Last ACTIVE manager (admin or super_admin) cannot be demoted out of management.
  if (isAdminRole(currentRole) && !isAdminRole(nextRole)) {
    const managerCount = await User.countDocuments({
      role: { $in: [...ADMIN_ROLES] },
      status: { $ne: "disabled" },
    });
    if (managerCount <= 1) return { ok: false, reason: "last_admin" };
  }

  await User.updateOne({ _id: userId }, { $set: { role: nextRole } });
  await writeAudit({
    actorId: grant.rootId,
    action: "user.role_changed",
    targetType: "user",
    targetId: userId,
    before: { role: currentRole },
    after: { role: nextRole },
  });
  await notify({
    userId,
    type: "role.changed",
    title: "התפקיד שלך עודכן",
    body: "ההרשאה החדשה תיכנס לתוקף לאחר התחברות מחדש.",
    relatedType: "user",
    relatedId: userId,
    link: "/settings/profile",
  });

  const [fresh, count] = await Promise.all([
    User.findById(userId).select(USER_PROJECTION).lean<LeanUser | null>(),
    Trainee.countDocuments({ commanderId: userId }),
  ]);
  if (!fresh) return { ok: false, reason: "not_found" };
  return { ok: true, user: serializeUser(fresh, count) };
}

export type SetStatusReason = "not_found" | "last_admin" | "self_forbidden" | DenyReason;

export type SetStatusResult =
  | { ok: true; user: AdminUserDTO }
  | { ok: false; reason: SetStatusReason };

/**
 * Suspend / disable / reactivate a user. Any manager (`AdminGrant`) may call this;
 * `canChangeStatus` decides legality (root target untouchable; super_admin status
 * is root-only; a plain admin may act only on STAFF in their own course). Extra
 * live guards here: you cannot deactivate yourself, and you cannot remove the last
 * active manager. Audited.
 */
export async function adminSetUserStatus(
  grant: AdminGrant,
  userId: string,
  nextStatus: UserStatus,
  opts: { reason?: string } = {},
): Promise<SetStatusResult> {
  if (!isValidObjectId(userId)) return { ok: false, reason: "not_found" };
  await connectToDatabase();

  const target = await User.findById(userId).select(USER_PROJECTION).lean<LeanUser | null>();
  if (!target) return { ok: false, reason: "not_found" };

  const currentStatus: UserStatus = isUserStatus(target.status) ? target.status : "active";
  const currentRole: UserRole = isUserRole(target.role) ? target.role : "staff";

  // Never let an operator lock themselves out.
  if (String(target._id) === grant.adminId && nextStatus !== "active") {
    return { ok: false, reason: "self_forbidden" };
  }

  const actor: PolicyActor = {
    id: grant.adminId,
    role: grant.role,
    isRoot: grant.isRoot,
    courseType: grant.courseScope?.courseType ?? null,
  };
  const verdict = canChangeStatus(actor, toPolicyTarget(target), nextStatus);
  if (!verdict.allowed) return { ok: false, reason: verdict.reason };

  // No-op.
  if (currentStatus === nextStatus) {
    const count = await Trainee.countDocuments({ commanderId: userId });
    return { ok: true, user: serializeUser(target, count) };
  }

  // Deactivating a manager must leave at least one other active manager.
  if (isAdminRole(currentRole) && nextStatus !== "active") {
    const otherActiveManagers = await User.countDocuments({
      role: { $in: [...ADMIN_ROLES] },
      status: "active",
      _id: { $ne: target._id },
    });
    if (otherActiveManagers < 1) return { ok: false, reason: "last_admin" };
  }

  await User.updateOne({ _id: userId }, { $set: { status: nextStatus } });
  await writeAudit({
    actorId: grant.adminId,
    action: "user.status_changed",
    targetType: "user",
    targetId: userId,
    before: { status: currentStatus },
    after: { status: nextStatus },
    reason: opts.reason,
  });
  await notify({
    userId,
    type: nextStatus === "active" ? "account.reactivated" : "account.suspended",
    title: nextStatus === "active" ? "החשבון הופעל מחדש" : nextStatus === "suspended" ? "החשבון הושהה" : "החשבון הושבת",
    relatedType: "user",
    relatedId: userId,
    link: "/settings/profile",
  });

  const [fresh, count] = await Promise.all([
    User.findById(userId).select(USER_PROJECTION).lean<LeanUser | null>(),
    Trainee.countDocuments({ commanderId: userId }),
  ]);
  if (!fresh) return { ok: false, reason: "not_found" };
  return { ok: true, user: serializeUser(fresh, count) };
}

export type SetVisibilityResult =
  | { ok: true; user: AdminUserDTO }
  | { ok: false; reason: "not_found" | "root_protected" };

/**
 * Set a user's directory visibility. Visibility affects listings only, never
 * authorization/audit. A protected ROOT account's visibility is immutable via the
 * API (changing a hidden owner to visible, or vice-versa, is a bootstrap-only op).
 */
export async function adminSetUserVisibility(
  grant: AdminGrant,
  userId: string,
  visibility: DirectoryVisibility,
): Promise<SetVisibilityResult> {
  if (!isValidObjectId(userId)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const target = await User.findById(userId).select(USER_PROJECTION).lean<LeanUser | null>();
  if (!target) return { ok: false, reason: "not_found" };
  if (target.isRootSuperAdmin === true) return { ok: false, reason: "root_protected" };
  // Only root manages a (regular) super_admin's directory visibility (§20) — a
  // regular super_admin does not manage peer super_admins.
  if (!grant.isRoot && isUserRole(target.role) && target.role === "super_admin") {
    return { ok: false, reason: "root_protected" };
  }

  const before = isDirectoryVisibility(target.directoryVisibility) ? target.directoryVisibility : "visible";
  await User.updateOne({ _id: userId }, { $set: { directoryVisibility: visibility } });
  await writeAudit({
    actorId: grant.adminId,
    action: "user.visibility_changed",
    targetType: "user",
    targetId: userId,
    before: { directoryVisibility: before },
    after: { directoryVisibility: visibility },
  });

  const [fresh, count] = await Promise.all([
    User.findById(userId).select(USER_PROJECTION).lean<LeanUser | null>(),
    Trainee.countDocuments({ commanderId: userId }),
  ]);
  if (!fresh) return { ok: false, reason: "not_found" };
  return { ok: true, user: serializeUser(fresh, count) };
}

/* -------------------------------------------------------------------------- */
/* Ownership transfer (guarded)                                                */
/* -------------------------------------------------------------------------- */

export type TransferResult =
  | { ok: true; trainee: AdminTraineeDTO }
  | { ok: false; reason: "not_found" | "invalid_target" | "out_of_scope" | "invalid_input" };

/** A plain admin is course-bound; a super_admin (courseScope null) is global. courseId-first. */
function traineeInScope(grant: AdminGrant, trainee: { courseId: string | null; courseType: string | null }): boolean {
  if (!grant.courseScope) return true;
  return sameCourse(
    { courseId: grant.courseScope.courseId, courseType: grant.courseScope.courseType },
    trainee,
  );
}

/**
 * Transfer a trainee to a new owner. Separate from the content-update path (which
 * structurally cannot re-home a trainee). Rules:
 *   - The trainee must be within the actor's scope (same course for a plain admin).
 *   - The new owner must exist, be staff, and be in the SAME course (transfer never
 *     crosses courses).
 *   - A non-empty reason is required.
 *   - `originalOwnerId` is preserved (set once if a legacy record lacks it).
 *   - The trainee's attachments are re-homed to the new owner.
 *   - Before/after + reason are audited.
 */
export async function transferTraineeOwnership(
  grant: AdminGrant,
  traineeId: string,
  toUserId: string,
  reason: string,
): Promise<TransferResult> {
  if (!isValidObjectId(traineeId) || !isValidObjectId(toUserId)) {
    return { ok: false, reason: "not_found" };
  }
  const cleanReason = (reason ?? "").trim();
  if (!cleanReason) return { ok: false, reason: "invalid_input" };
  await connectToDatabase();

  const trainee = await Trainee.findById(traineeId)
    .select("_id commanderId ownerId originalOwnerId courseType courseId")
    .lean<{ _id: unknown; commanderId?: unknown; ownerId?: unknown; originalOwnerId?: unknown; courseType?: string; courseId?: unknown } | null>();
  if (!trainee) return { ok: false, reason: "not_found" };
  const traineeCourse = {
    courseId: trainee.courseId ? String(trainee.courseId) : null,
    courseType: trainee.courseType ?? null,
  };
  if (!traineeInScope(grant, traineeCourse)) return { ok: false, reason: "out_of_scope" };

  const target = await User.findById(toUserId)
    .select("_id role courseType courseId")
    .lean<{ _id: unknown; role?: string; courseType?: string; courseId?: unknown } | null>();
  if (!target) return { ok: false, reason: "invalid_target" };
  // New owner must be staff in the SAME course as the trainee (courseId-first).
  const targetCourse = {
    courseId: target.courseId ? String(target.courseId) : null,
    courseType: target.courseType ?? null,
  };
  if (target.role !== "staff" || !sameCourse(targetCourse, traineeCourse)) {
    return { ok: false, reason: "invalid_target" };
  }

  const before = {
    commanderId: trainee.commanderId ? String(trainee.commanderId) : null,
    ownerId: trainee.ownerId ? String(trainee.ownerId) : null,
  };
  const newOwner = new Types.ObjectId(toUserId);
  const set: Record<string, unknown> = {
    commanderId: newOwner,
    ownerId: newOwner,
    lastUpdatedBy: new Types.ObjectId(grant.adminId),
  };
  // Preserve the first owner: set originalOwnerId only if a legacy record lacks it.
  if (!trainee.originalOwnerId && trainee.commanderId) {
    set.originalOwnerId = trainee.commanderId;
  }

  await Trainee.updateOne({ _id: traineeId }, { $set: set });
  // Re-home the trainee's attachments to the new owner (same course).
  await TraineeAttachment.updateMany({ traineeId }, { $set: { ownerId: newOwner } });

  await writeAudit({
    actorId: grant.adminId,
    action: "trainee.owner_changed",
    targetType: "trainee",
    targetId: traineeId,
    before,
    after: { commanderId: toUserId, ownerId: toUserId },
    reason: cleanReason,
  });
  await notify({
    userId: toUserId,
    type: "trainee.transferred",
    title: "תיק חניך הועבר אליך",
    relatedType: "trainee",
    relatedId: traineeId,
    link: `/trainees/${traineeId}`,
  });

  const fresh = await Trainee.findById(traineeId).lean<LeanTrainee | null>();
  return { ok: true, trainee: serializeTrainee(fresh as LeanTrainee) };
}
