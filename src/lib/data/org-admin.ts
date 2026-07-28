import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Team } from "@/models";
import type { AdminGrant } from "@/lib/auth/require-admin";
import {
  listCohorts,
  getCohort,
  createCohort,
  updateCohort,
  setCohortStatus,
  type CohortDTO,
  type CohortResult,
} from "@/lib/data/cohorts";
import {
  listTeams,
  createTeam,
  updateTeam,
  setTeamActive,
  type TeamDTO,
  type TeamResult,
} from "@/lib/data/teams";
import type { CohortStatus } from "@/lib/domain/types";

/**
 * Course-SCOPED wrappers over the org services, for the management UIs. A plain
 * admin (grant.courseScope set) may only read/write cohorts + teams in THEIR
 * course; a super_admin (courseScope null) is global. Every wrapper verifies the
 * target's course against the grant before delegating, so an id from another
 * course simply fails.
 */

const OUT_OF_SCOPE = { ok: false as const, reason: "not_found" as const };

/** super_admin → global; admin → their courseId must match. */
function courseInScope(grant: AdminGrant, courseId: string | null | undefined): boolean {
  if (!grant.courseScope) return true;
  return Boolean(courseId) && grant.courseScope.courseId === String(courseId);
}

async function cohortInScope(grant: AdminGrant, cohortId: string): Promise<boolean> {
  if (!grant.courseScope) return true;
  if (!isValidObjectId(cohortId)) return false;
  await connectToDatabase();
  const c = await Cohort.findById(cohortId).select("courseId").lean<{ courseId?: unknown } | null>();
  return Boolean(c) && courseInScope(grant, c!.courseId ? String(c!.courseId) : null);
}

async function teamInScope(grant: AdminGrant, teamId: string): Promise<boolean> {
  if (!grant.courseScope) return true;
  if (!isValidObjectId(teamId)) return false;
  await connectToDatabase();
  const t = await Team.findById(teamId).select("courseId").lean<{ courseId?: unknown } | null>();
  return Boolean(t) && courseInScope(grant, t!.courseId ? String(t!.courseId) : null);
}

/* --- Cohorts ------------------------------------------------------------- */

export async function adminListCohorts(grant: AdminGrant): Promise<CohortDTO[]> {
  const courseId = grant.courseScope?.courseId ?? undefined;
  return listCohorts({ courseId, includeArchived: true });
}

export async function adminCreateCohort(
  grant: AdminGrant,
  input: { courseId?: string; name: string; code?: string; status?: CohortStatus },
): Promise<CohortResult> {
  // An admin can only create in their own course; a super_admin must pass a course.
  const courseId = grant.courseScope ? grant.courseScope.courseId ?? "" : input.courseId ?? "";
  if (!courseId) return { ok: false, reason: "invalid_course" };
  if (!courseInScope(grant, courseId)) return { ok: false, reason: "invalid_course" };
  return createCohort(grant.adminId, { courseId, name: input.name, code: input.code, status: input.status });
}

export async function adminUpdateCohort(
  grant: AdminGrant,
  id: string,
  patch: { name?: string; code?: string },
): Promise<CohortResult> {
  if (!(await cohortInScope(grant, id))) return OUT_OF_SCOPE;
  return updateCohort(grant.adminId, id, patch);
}

export async function adminSetCohortStatus(grant: AdminGrant, id: string, status: CohortStatus): Promise<CohortResult> {
  if (!(await cohortInScope(grant, id))) return OUT_OF_SCOPE;
  return setCohortStatus(grant.adminId, id, status);
}

export async function adminGetCohort(grant: AdminGrant, id: string): Promise<CohortDTO | null> {
  if (!(await cohortInScope(grant, id))) return null;
  return getCohort(id);
}

/* --- Teams --------------------------------------------------------------- */

export async function adminListTeams(grant: AdminGrant, cohortId?: string): Promise<TeamDTO[]> {
  const courseId = grant.courseScope?.courseId ?? undefined;
  if (cohortId && !(await cohortInScope(grant, cohortId))) return [];
  return listTeams({ courseId, cohortId, includeInactive: true });
}

export async function adminCreateTeam(
  grant: AdminGrant,
  input: { cohortId: string; name: string; code?: string },
): Promise<TeamResult> {
  if (!(await cohortInScope(grant, input.cohortId))) return { ok: false, reason: "invalid_cohort" };
  return createTeam(grant.adminId, input);
}

export async function adminUpdateTeam(grant: AdminGrant, id: string, patch: { name?: string; code?: string }): Promise<TeamResult> {
  if (!(await teamInScope(grant, id))) return { ok: false, reason: "not_found" };
  return updateTeam(grant.adminId, id, patch);
}

export async function adminSetTeamActive(grant: AdminGrant, id: string, isActive: boolean): Promise<TeamResult> {
  if (!(await teamInScope(grant, id))) return { ok: false, reason: "not_found" };
  return setTeamActive(grant.adminId, id, isActive);
}
