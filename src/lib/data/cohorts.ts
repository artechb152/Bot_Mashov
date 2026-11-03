import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Course, User, UserAssignment } from "@/models";
import { writeAudit } from "@/lib/data/audit";
import { notifyMany } from "@/lib/data/notifications";
import { courseTypeForId } from "@/lib/data/courses";
import { COHORT_STATUSES, isCohortStatus, type CohortStatus, type CourseType } from "@/lib/domain/types";

/**
 * Cohort service — a course cycle. Archiving is a status change (no separate
 * collection). Every mutation is audited. (The cohort edit-freeze feature was
 * removed; the legacy `isLocked`/`cohortLocked` fields remain in the DB for
 * compatibility but are no longer written or used to block editing.)
 *
 * Server-only. Authorization (course scope / role) is enforced by the CALLER
 * (route/action); these functions take an `actorId` for the audit trail.
 */

export type CohortDTO = {
  id: string;
  courseId: string;
  courseType: CourseType | null;
  name: string;
  code: string | null;
  status: CohortStatus;
  isLocked: boolean;
  isLegacyDefault: boolean;
  startDate: string | null;
  endDate: string | null;
};

type LeanCohort = {
  _id: unknown;
  courseId?: unknown;
  name?: string;
  code?: string | null;
  status?: string | null;
  isLocked?: boolean;
  isLegacyDefault?: boolean;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
};

/** Notify the staff currently assigned to a cohort (best-effort). */
async function notifyCohortStaff(cohortId: string, type: string, title: string): Promise<void> {
  const assignments = await UserAssignment.find({ cohortId, isCurrent: true, role: "staff" })
    .select("userId")
    .lean<{ userId?: unknown }[]>();
  const userIds = assignments.map((a) => String(a.userId)).filter(Boolean);
  if (userIds.length > 0) {
    await notifyMany(userIds, { type, title, relatedType: "cohort", relatedId: cohortId, link: "/trainees" });
  }
}

async function serializeCohort(doc: LeanCohort): Promise<CohortDTO> {
  const courseId = doc.courseId ? String(doc.courseId) : "";
  return {
    id: String(doc._id),
    courseId,
    courseType: courseId ? await courseTypeForId(courseId) : null,
    name: doc.name ?? "",
    code: doc.code ?? null,
    status: isCohortStatus(doc.status) ? doc.status : "planned",
    isLocked: doc.isLocked === true,
    isLegacyDefault: doc.isLegacyDefault === true,
    startDate: doc.startDate ? new Date(doc.startDate).toISOString() : null,
    endDate: doc.endDate ? new Date(doc.endDate).toISOString() : null,
  };
}

export async function listCohorts(filter: {
  courseId?: string;
  status?: CohortStatus;
  includeArchived?: boolean;
} = {}): Promise<CohortDTO[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (filter.courseId && isValidObjectId(filter.courseId)) q.courseId = filter.courseId;
  if (filter.status) q.status = filter.status;
  else if (!filter.includeArchived) q.status = { $ne: "archived" };
  const docs = await Cohort.find(q).sort({ createdAt: -1, _id: -1 }).lean<LeanCohort[]>();
  return Promise.all(docs.map(serializeCohort));
}

export async function getCohort(id: string): Promise<CohortDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Cohort.findById(id).lean<LeanCohort | null>();
  return doc ? serializeCohort(doc) : null;
}

/**
 * Whether a cohort is a valid assignment target for a given course: it exists, is not
 * archived, and belongs to that course. Used to validate a client-chosen cohortId on
 * a trainee create/edit (cohort is a filter, never an authz key — course+owner still
 * gate access).
 */
export async function isCohortInCourse(cohortId: string, courseType: CourseType): Promise<boolean> {
  const cohort = await getCohort(cohortId);
  return Boolean(cohort && cohort.status !== "archived" && cohort.courseType === courseType);
}

export type CreateCohortInput = {
  courseId: string;
  name: string;
  code?: string;
  status?: CohortStatus;
  startDate?: Date | null;
  endDate?: Date | null;
};

export type CohortResult =
  | { ok: true; cohort: CohortDTO }
  | { ok: false; reason: "invalid_course" | "invalid_input" | "not_found" | "duplicate" };

export async function createCohort(actorId: string, input: CreateCohortInput): Promise<CohortResult> {
  await connectToDatabase();
  if (!isValidObjectId(input.courseId)) return { ok: false, reason: "invalid_course" };
  const course = await Course.findById(input.courseId).select("_id").lean();
  if (!course) return { ok: false, reason: "invalid_course" };
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, reason: "invalid_input" };
  const status: CohortStatus = input.status && isCohortStatus(input.status) ? input.status : "planned";

  try {
    const doc = await Cohort.create({
      courseId: new Types.ObjectId(input.courseId),
      name,
      code: input.code?.trim() || undefined,
      status,
      startDate: input.startDate ?? undefined,
      endDate: input.endDate ?? undefined,
      createdBy: new Types.ObjectId(actorId),
      updatedBy: new Types.ObjectId(actorId),
    });
    const cohort = await serializeCohort(doc.toObject() as LeanCohort);
    await writeAudit({
      actorId,
      action: "cohort.created",
      targetType: "cohort",
      targetId: cohort.id,
      after: { courseId: cohort.courseId, name: cohort.name, status: cohort.status },
    });
    // A newly created cohort becomes the CREATOR's personal default (theirs only) —
    // best-effort, never blocks creation.
    try {
      if (isValidObjectId(actorId)) {
        await User.updateOne({ _id: actorId }, { $set: { defaultCohortId: new Types.ObjectId(cohort.id) } });
      }
    } catch (err) {
      console.error("[cohorts] set creator default failed:", err);
    }
    return { ok: true, cohort };
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
      return { ok: false, reason: "duplicate" };
    }
    throw err;
  }
}

export type UpdateCohortPatch = {
  name?: string;
  code?: string;
  startDate?: Date | null;
  endDate?: Date | null;
};

export async function updateCohort(
  actorId: string,
  id: string,
  patch: UpdateCohortPatch,
): Promise<CohortResult> {
  if (!isValidObjectId(id)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const before = await Cohort.findById(id).lean<LeanCohort | null>();
  if (!before) return { ok: false, reason: "not_found" };

  // Whitelist — never accept courseId/status/isLocked through this path.
  const set: Record<string, unknown> = { updatedBy: new Types.ObjectId(actorId) };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) return { ok: false, reason: "invalid_input" };
    set.name = name;
  }
  if (typeof patch.code === "string") set.code = patch.code.trim() || undefined;
  if (patch.startDate !== undefined) set.startDate = patch.startDate ?? undefined;
  if (patch.endDate !== undefined) set.endDate = patch.endDate ?? undefined;

  const doc = await Cohort.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean<LeanCohort | null>();
  if (!doc) return { ok: false, reason: "not_found" };
  const cohort = await serializeCohort(doc);
  await writeAudit({
    actorId,
    action: "cohort.edited",
    targetType: "cohort",
    targetId: id,
    before: { name: before.name, code: before.code ?? null },
    after: { name: cohort.name, code: cohort.code },
  });
  return { ok: true, cohort };
}

export async function setCohortStatus(
  actorId: string,
  id: string,
  status: CohortStatus,
): Promise<CohortResult> {
  if (!isValidObjectId(id) || !isCohortStatus(status)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const before = await Cohort.findById(id).lean<LeanCohort | null>();
  if (!before) return { ok: false, reason: "not_found" };
  await Cohort.updateOne({ _id: id }, { $set: { status, updatedBy: new Types.ObjectId(actorId) } });
  const doc = await Cohort.findById(id).lean<LeanCohort | null>();
  const cohort = await serializeCohort(doc as LeanCohort);
  const action =
    status === "archived" ? "cohort.archived" : status === "active" ? "cohort.restored" : "cohort.status_changed";
  await writeAudit({
    actorId,
    action,
    targetType: "cohort",
    targetId: id,
    before: { status: before.status },
    after: { status },
  });
  if (status === "archived") await notifyCohortStaff(id, "cohort.archived", `המחזור "${cohort.name}" הועבר לארכיון`);
  return { ok: true, cohort };
}

/**
 * Idempotently ensure the "__legacy__" default cohort for a course exists (the
 * bucket the backfill/seed drops pre-hierarchy records into). Returns its id.
 */
export async function ensureLegacyCohort(actorId: string, courseId: string): Promise<string> {
  await connectToDatabase();
  const code = "__legacy__";
  await Cohort.updateOne(
    { courseId: new Types.ObjectId(courseId), code },
    {
      $setOnInsert: {
        courseId: new Types.ObjectId(courseId),
        code,
        name: "מחזור מדור קודם",
        status: "active",
        isLocked: false,
        isLegacyDefault: true,
        createdBy: new Types.ObjectId(actorId),
        updatedBy: new Types.ObjectId(actorId),
      },
    },
    { upsert: true },
  );
  const doc = await Cohort.findOne({ courseId: new Types.ObjectId(courseId), code }).select("_id").lean();
  return String((doc as { _id: unknown })._id);
}

export { COHORT_STATUSES };
