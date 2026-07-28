import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Trainee } from "@/models";
import { courseIdForType } from "@/lib/data/courses";
import type { OwnerScope } from "@/lib/data/scope";
import type { CourseType, TraineeStatus } from "@/lib/domain/types";

/**
 * Data-access layer for trainees. Route handlers and server components call
 * these functions instead of touching Mongoose directly. Everything returned is
 * a plain, serialisable DTO (no ObjectId / Date) so it can cross the
 * server→client boundary safely.
 */

export type TraineeDTO = {
  id: string;
  fullName: string;
  courseType: CourseType;
  team: string;
  strengths: string[];
  weaknesses: string[];
  notes: string;
  status: TraineeStatus;
  cohortId: string | null;
  teamId: string | null;
  cohortLocked: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TraineeInput = {
  fullName: string;
  team: string;
  strengths: string[];
  weaknesses: string[];
  notes: string;
};

/** Optional org placement stamped onto a new trainee (from the staff user's context). */
export type TraineeOrgContext = {
  cohortId?: string | null;
  teamId?: string | null;
};

type LeanTrainee = {
  _id: unknown;
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

function serialize(doc: LeanTrainee): TraineeDTO {
  return {
    id: String(doc._id),
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

/**
 * Every function is SCOPED to the caller's `OwnerScope` — the owner id AND the
 * course, both derived server-side from the session (see `lib/data/scope.ts`).
 *
 * Each query filters on `{ commanderId, courseType }`, so a user can only
 * list/read/update/delete trainees that are both theirs AND in their course, and
 * new trainees are created stamped with that same pair. A trainee id belonging
 * to another user — or to the other course — simply does not match, and the
 * caller gets `null`/`false` (which the routes turn into a 404). Writes
 * additionally refuse trainees in a LOCKED cohort (read-only for staff).
 */

/** The owner+course filter every read is built on. */
function scopeFilter(scope: OwnerScope) {
  return { commanderId: scope.ownerId, courseType: scope.courseType };
}

/** The write filter — owner + course. (Cohort edit-freeze was removed; the legacy
 *  `cohortLocked` field is left in the DB but no longer blocks editing.) */
function writeScopeFilter(scope: OwnerScope) {
  return { commanderId: scope.ownerId, courseType: scope.courseType };
}

export async function listTrainees(
  scope: OwnerScope,
  filter: { cohortId?: string; status?: TraineeStatus } = {},
): Promise<TraineeDTO[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = scopeFilter(scope);
  if (filter.cohortId && isValidObjectId(filter.cohortId)) q.cohortId = filter.cohortId;
  if (filter.status) q.status = filter.status;
  const docs = await Trainee.find(q).sort({ createdAt: -1, _id: -1 }).lean<LeanTrainee[]>();
  return docs.map(serialize);
}

export async function getTrainee(id: string, scope: OwnerScope): Promise<TraineeDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Trainee.findOne({ _id: id, ...scopeFilter(scope) }).lean<LeanTrainee | null>();
  return doc ? serialize(doc) : null;
}

export async function createTrainee(
  input: TraineeInput,
  scope: OwnerScope,
  org: TraineeOrgContext = {},
): Promise<TraineeDTO> {
  await connectToDatabase();
  const owner = new Types.ObjectId(scope.ownerId);
  const courseId = await courseIdForType(scope.courseType);
  const doc = await Trainee.create({
    ...input,
    commanderId: owner,
    courseType: scope.courseType,
    // Ownership provenance stamped from the session — never from the request body.
    ownerId: owner,
    originalOwnerId: owner,
    createdBy: owner,
    lastUpdatedBy: owner,
    courseId: courseId ? new Types.ObjectId(courseId) : undefined,
    cohortId: org.cohortId && isValidObjectId(org.cohortId) ? new Types.ObjectId(org.cohortId) : undefined,
    teamId: org.teamId && isValidObjectId(org.teamId) ? new Types.ObjectId(org.teamId) : undefined,
    status: "active",
  });
  return serialize(doc.toObject() as LeanTrainee);
}

export async function updateTrainee(
  id: string,
  patch: Partial<TraineeInput>,
  scope: OwnerScope,
): Promise<TraineeDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Trainee.findOneAndUpdate(
    { _id: id, ...writeScopeFilter(scope) },
    { $set: { ...patch, lastUpdatedBy: new Types.ObjectId(scope.ownerId) } },
    { new: true, runValidators: true },
  ).lean<LeanTrainee | null>();
  return doc ? serialize(doc) : null;
}

export async function deleteTrainee(id: string, scope: OwnerScope): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectToDatabase();
  const res = await Trainee.findOneAndDelete({
    _id: id,
    ...writeScopeFilter(scope),
  }).lean<LeanTrainee | null>();
  return Boolean(res);
}

/**
 * UNSCOPED read of a single trainee's content. Call ONLY after an access gate
 * (`requireTraineeAccess`) has authorized the caller — used for grant/admin/super
 * access where the owner-scoped `getTrainee` would not match.
 */
export async function readTraineeById(id: string): Promise<TraineeDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Trainee.findById(id).lean<LeanTrainee | null>();
  return doc ? serialize(doc) : null;
}

/**
 * UNSCOPED content update. Call ONLY after `requireTraineeAccess({write:true})`
 * has authorized the editor. Whitelisted content fields only — ownership/course
 * remain un-settable here. Stamps lastUpdatedBy.
 */
export async function updateTraineeById(
  id: string,
  patch: Partial<TraineeInput>,
  editorId: string,
): Promise<TraineeDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Trainee.findByIdAndUpdate(
    id,
    { $set: { ...patch, lastUpdatedBy: new Types.ObjectId(editorId) } },
    { new: true, runValidators: true },
  ).lean<LeanTrainee | null>();
  return doc ? serialize(doc) : null;
}

export type OwnedCohortDTO = { id: string; name: string; status: string; isLocked: boolean };

/**
 * The cohorts the staff user actually has trainee records in — the options for
 * their cohort selector / archive view. Owner-scoped, so it never reveals cohorts
 * the user has no records in.
 */
export async function listOwnedCohorts(scope: OwnerScope): Promise<OwnedCohortDTO[]> {
  await connectToDatabase();
  const ids = (await Trainee.distinct("cohortId", scopeFilter(scope))).filter(Boolean);
  if (ids.length === 0) return [];
  const cohorts = await Cohort.find({ _id: { $in: ids } })
    .select("_id name status isLocked")
    .sort({ createdAt: -1, _id: -1 })
    .lean<{ _id: unknown; name?: string; status?: string; isLocked?: boolean }[]>();
  return cohorts.map((c) => ({
    id: String(c._id),
    name: c.name ?? "",
    status: c.status ?? "active",
    isLocked: c.isLocked === true,
  }));
}
