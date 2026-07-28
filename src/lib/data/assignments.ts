import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Team, User, UserAssignment } from "@/models";
import { writeAudit } from "@/lib/data/audit";
import { notify } from "@/lib/data/notifications";
import { courseTypeForId } from "@/lib/data/courses";
import { isAdminPosition, isUserRole, type AdminPosition, type UserRole } from "@/lib/domain/types";

/**
 * UserAssignment service — a user's org placement over time. History is preserved:
 * moving a user closes their current row (isCurrent=false, endedAt set) and opens a
 * new one; old rows are never deleted. At most one current assignment per user
 * (partial-unique index enforces it). Mutations are audited.
 *
 * Server-only. Authorization is enforced by the caller.
 */

export type AssignmentType = "staff_team" | "course_admin";

export type AssignmentDTO = {
  id: string;
  userId: string;
  courseId: string;
  cohortId: string | null;
  teamId: string | null;
  assignmentType: AssignmentType;
  role: UserRole | null;
  adminPosition: AdminPosition | null;
  isCurrent: boolean;
  startedAt: string | null;
  endedAt: string | null;
};

type LeanAssignment = {
  _id: unknown;
  userId?: unknown;
  courseId?: unknown;
  cohortId?: unknown;
  teamId?: unknown;
  assignmentType?: string;
  role?: string | null;
  adminPosition?: string | null;
  isCurrent?: boolean;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
};

function serialize(doc: LeanAssignment): AssignmentDTO {
  return {
    id: String(doc._id),
    userId: doc.userId ? String(doc.userId) : "",
    courseId: doc.courseId ? String(doc.courseId) : "",
    cohortId: doc.cohortId ? String(doc.cohortId) : null,
    teamId: doc.teamId ? String(doc.teamId) : null,
    assignmentType: doc.assignmentType === "course_admin" ? "course_admin" : "staff_team",
    role: isUserRole(doc.role) ? doc.role : null,
    adminPosition: isAdminPosition(doc.adminPosition) ? doc.adminPosition : null,
    isCurrent: doc.isCurrent === true,
    startedAt: doc.startedAt ? new Date(doc.startedAt).toISOString() : null,
    endedAt: doc.endedAt ? new Date(doc.endedAt).toISOString() : null,
  };
}

export async function getCurrentAssignment(userId: string): Promise<AssignmentDTO | null> {
  if (!isValidObjectId(userId)) return null;
  await connectToDatabase();
  const doc = await UserAssignment.findOne({ userId, isCurrent: true }).lean<LeanAssignment | null>();
  return doc ? serialize(doc) : null;
}

export async function listAssignments(userId: string): Promise<AssignmentDTO[]> {
  if (!isValidObjectId(userId)) return [];
  await connectToDatabase();
  const docs = await UserAssignment.find({ userId }).sort({ startedAt: -1, _id: -1 }).lean<LeanAssignment[]>();
  return docs.map(serialize);
}

export type AssignmentInput = {
  courseId: string;
  cohortId?: string | null;
  teamId?: string | null;
  assignmentType: AssignmentType;
  role?: UserRole;
  adminPosition?: AdminPosition;
};

/**
 * THE centralized service for moving a user's current org placement. It:
 *   1. validates the course → cohort → team relationships,
 *   2. closes the existing current assignment (history preserved — never deleted),
 *   3. opens a fresh current assignment,
 *   4. keeps `User.courseId` (the authoritative course scope) consistent, mirroring
 *      the legacy `courseType` for untouched code during the migration,
 *   5. audits + notifies.
 * All course/cohort/team moves must go through here so `User.courseId` and
 * `UserAssignment` can never drift apart.
 */
export async function setCurrentAssignment(
  actorId: string,
  userId: string,
  input: AssignmentInput,
): Promise<{ ok: true; assignment: AssignmentDTO } | { ok: false; reason: "invalid_input" }> {
  if (!isValidObjectId(userId) || !isValidObjectId(input.courseId)) {
    return { ok: false, reason: "invalid_input" };
  }
  await connectToDatabase();

  // Validate org relationships (courseId is authoritative): cohort ∈ course, team ∈
  // cohort (and thus ∈ course). Prevents an assignment that places a user in a
  // cohort/team belonging to a different course.
  if (input.cohortId) {
    if (!isValidObjectId(input.cohortId)) return { ok: false, reason: "invalid_input" };
    const cohort = await Cohort.findById(input.cohortId).select("courseId").lean<{ courseId?: unknown } | null>();
    if (!cohort || String(cohort.courseId) !== String(input.courseId)) {
      return { ok: false, reason: "invalid_input" };
    }
  }
  if (input.teamId) {
    if (!isValidObjectId(input.teamId)) return { ok: false, reason: "invalid_input" };
    const team = await Team.findById(input.teamId).select("courseId cohortId").lean<{ courseId?: unknown; cohortId?: unknown } | null>();
    if (!team || String(team.courseId) !== String(input.courseId)) {
      return { ok: false, reason: "invalid_input" };
    }
    if (input.cohortId && String(team.cohortId) !== String(input.cohortId)) {
      return { ok: false, reason: "invalid_input" };
    }
  }

  const prev = await UserAssignment.findOne({ userId, isCurrent: true }).lean<LeanAssignment | null>();
  // Close the old current first so the partial-unique {userId,isCurrent} allows the new one.
  if (prev) {
    await UserAssignment.updateOne(
      { _id: prev._id },
      { $set: { isCurrent: false, endedAt: new Date() } },
    );
  }

  const doc = await UserAssignment.create({
    userId: new Types.ObjectId(userId),
    courseId: new Types.ObjectId(input.courseId),
    cohortId: input.cohortId && isValidObjectId(input.cohortId) ? new Types.ObjectId(input.cohortId) : undefined,
    teamId: input.teamId && isValidObjectId(input.teamId) ? new Types.ObjectId(input.teamId) : undefined,
    assignmentType: input.assignmentType,
    role: input.role,
    adminPosition: input.adminPosition,
    isCurrent: true,
    startedAt: new Date(),
    assignedBy: new Types.ObjectId(actorId),
  });

  const assignment = serialize(doc.toObject() as LeanAssignment);

  // Keep the user's authoritative course scope in lockstep with the new current
  // assignment. Mirror the legacy `courseType` so untouched courseType-based code
  // stays correct during the migration.
  const courseType = await courseTypeForId(input.courseId);
  await User.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $set: { courseId: new Types.ObjectId(input.courseId), ...(courseType ? { courseType } : {}) } },
  );

  await writeAudit({
    actorId,
    action: "assignment.changed",
    targetType: "assignment",
    targetId: assignment.id,
    before: prev
      ? { courseId: String(prev.courseId), cohortId: prev.cohortId ? String(prev.cohortId) : null, teamId: prev.teamId ? String(prev.teamId) : null }
      : undefined,
    after: { courseId: assignment.courseId, cohortId: assignment.cohortId, teamId: assignment.teamId, assignmentType: assignment.assignmentType },
    metadata: { userId },
  });
  await notify({
    userId,
    type: "assignment.changed",
    title: "השיוך הארגוני שלך עודכן",
    relatedType: "assignment",
    relatedId: assignment.id,
    link: "/settings/profile",
  });
  return { ok: true, assignment };
}

/**
 * Idempotently ensure a user has a current assignment matching `input` (upsert on
 * {userId, isCurrent:true}). For seeding/backfill — does NOT create history.
 * Returns the current assignment id.
 */
export async function ensureCurrentAssignment(
  actorId: string,
  userId: string,
  input: AssignmentInput,
): Promise<string> {
  await connectToDatabase();
  await UserAssignment.updateOne(
    { userId: new Types.ObjectId(userId), isCurrent: true },
    {
      $set: {
        courseId: new Types.ObjectId(input.courseId),
        cohortId: input.cohortId && isValidObjectId(input.cohortId) ? new Types.ObjectId(input.cohortId) : undefined,
        teamId: input.teamId && isValidObjectId(input.teamId) ? new Types.ObjectId(input.teamId) : undefined,
        assignmentType: input.assignmentType,
        role: input.role,
        adminPosition: input.adminPosition,
        assignedBy: new Types.ObjectId(actorId),
      },
      $setOnInsert: { startedAt: new Date() },
    },
    { upsert: true },
  );
  const doc = await UserAssignment.findOne({ userId: new Types.ObjectId(userId), isCurrent: true }).select("_id").lean();
  return String((doc as { _id: unknown })._id);
}
