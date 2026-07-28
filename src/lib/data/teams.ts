import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Team } from "@/models";
import { writeAudit } from "@/lib/data/audit";

/**
 * Team service — a team within a cohort. A team's `courseId` always mirrors its
 * cohort's course (a team can never belong to a course different from its cohort's).
 * Team names are unique within a cohort. Every mutation is audited.
 *
 * Server-only. Authorization is enforced by the caller.
 */

export type TeamDTO = {
  id: string;
  courseId: string;
  cohortId: string;
  name: string;
  code: string | null;
  isActive: boolean;
  isLegacyDefault: boolean;
};

type LeanTeam = {
  _id: unknown;
  courseId?: unknown;
  cohortId?: unknown;
  name?: string;
  code?: string | null;
  isActive?: boolean;
  isLegacyDefault?: boolean;
};

function serializeTeam(doc: LeanTeam): TeamDTO {
  return {
    id: String(doc._id),
    courseId: doc.courseId ? String(doc.courseId) : "",
    cohortId: doc.cohortId ? String(doc.cohortId) : "",
    name: doc.name ?? "",
    code: doc.code ?? null,
    isActive: doc.isActive !== false,
    isLegacyDefault: doc.isLegacyDefault === true,
  };
}

export async function listTeams(filter: {
  cohortId?: string;
  courseId?: string;
  includeInactive?: boolean;
} = {}): Promise<TeamDTO[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (filter.cohortId && isValidObjectId(filter.cohortId)) q.cohortId = filter.cohortId;
  if (filter.courseId && isValidObjectId(filter.courseId)) q.courseId = filter.courseId;
  if (!filter.includeInactive) q.isActive = { $ne: false };
  const docs = await Team.find(q).sort({ name: 1, _id: 1 }).lean<LeanTeam[]>();
  return docs.map(serializeTeam);
}

export async function getTeam(id: string): Promise<TeamDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Team.findById(id).lean<LeanTeam | null>();
  return doc ? serializeTeam(doc) : null;
}

export type TeamResult =
  | { ok: true; team: TeamDTO }
  | { ok: false; reason: "invalid_cohort" | "invalid_input" | "not_found" | "duplicate" };

export async function createTeam(
  actorId: string,
  input: { cohortId: string; name: string; code?: string },
): Promise<TeamResult> {
  await connectToDatabase();
  if (!isValidObjectId(input.cohortId)) return { ok: false, reason: "invalid_cohort" };
  const cohort = await Cohort.findById(input.cohortId).select("_id courseId").lean<{ _id: unknown; courseId?: unknown } | null>();
  if (!cohort || !cohort.courseId) return { ok: false, reason: "invalid_cohort" };
  const name = (input.name ?? "").trim();
  if (!name) return { ok: false, reason: "invalid_input" };

  try {
    const doc = await Team.create({
      // courseId is taken from the cohort — never from the caller — so a team can
      // never be attached to a course different from its cohort's.
      courseId: cohort.courseId,
      cohortId: cohort._id,
      name,
      code: input.code?.trim() || undefined,
      isActive: true,
      createdBy: new Types.ObjectId(actorId),
      updatedBy: new Types.ObjectId(actorId),
    });
    const team = serializeTeam(doc.toObject() as LeanTeam);
    await writeAudit({
      actorId,
      action: "team.created",
      targetType: "team",
      targetId: team.id,
      after: { cohortId: team.cohortId, name: team.name },
    });
    return { ok: true, team };
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
      return { ok: false, reason: "duplicate" };
    }
    throw err;
  }
}

export async function updateTeam(
  actorId: string,
  id: string,
  patch: { name?: string; code?: string },
): Promise<TeamResult> {
  if (!isValidObjectId(id)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const before = await Team.findById(id).lean<LeanTeam | null>();
  if (!before) return { ok: false, reason: "not_found" };
  const set: Record<string, unknown> = { updatedBy: new Types.ObjectId(actorId) };
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (!name) return { ok: false, reason: "invalid_input" };
    set.name = name;
  }
  if (typeof patch.code === "string") set.code = patch.code.trim() || undefined;

  try {
    const doc = await Team.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true }).lean<LeanTeam | null>();
    if (!doc) return { ok: false, reason: "not_found" };
    const team = serializeTeam(doc);
    await writeAudit({
      actorId,
      action: "team.edited",
      targetType: "team",
      targetId: id,
      before: { name: before.name, code: before.code ?? null },
      after: { name: team.name, code: team.code },
    });
    return { ok: true, team };
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
      return { ok: false, reason: "duplicate" };
    }
    throw err;
  }
}

export async function setTeamActive(actorId: string, id: string, isActive: boolean): Promise<TeamResult> {
  if (!isValidObjectId(id)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const before = await Team.findById(id).lean<LeanTeam | null>();
  if (!before) return { ok: false, reason: "not_found" };
  await Team.updateOne({ _id: id }, { $set: { isActive, updatedBy: new Types.ObjectId(actorId) } });
  const doc = await Team.findById(id).lean<LeanTeam | null>();
  const team = serializeTeam(doc as LeanTeam);
  await writeAudit({
    actorId,
    action: isActive ? "team.enabled" : "team.disabled",
    targetType: "team",
    targetId: id,
    before: { isActive: before.isActive !== false },
    after: { isActive },
  });
  return { ok: true, team };
}

/**
 * Idempotently ensure the legacy default team for a cohort exists. Returns its id.
 */
export async function ensureLegacyTeam(actorId: string, courseId: string, cohortId: string): Promise<string> {
  await connectToDatabase();
  const name = "צוות מדור קודם";
  await Team.updateOne(
    { cohortId: new Types.ObjectId(cohortId), name },
    {
      $setOnInsert: {
        courseId: new Types.ObjectId(courseId),
        cohortId: new Types.ObjectId(cohortId),
        name,
        isActive: true,
        isLegacyDefault: true,
        createdBy: new Types.ObjectId(actorId),
        updatedBy: new Types.ObjectId(actorId),
      },
    },
    { upsert: true },
  );
  const doc = await Team.findOne({ cohortId: new Types.ObjectId(cohortId), name }).select("_id").lean();
  return String((doc as { _id: unknown })._id);
}
