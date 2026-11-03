import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Trainee, UserAssignment } from "@/models";
import { listCohorts } from "@/lib/data/cohorts";
import { listCourses, getCourse, courseIdForType } from "@/lib/data/courses";
import { pickActiveCohort } from "@/lib/workspace/nav";
import { COURSE_LABELS, isAdminRole, isCohortStatus, type CohortStatus, type CourseType } from "@/lib/domain/types";
import type { Account } from "@/lib/auth/account";

/**
 * Builds the /workspace navigation tree (courses → cohorts) for the sidebar, scoped
 * to what the caller may navigate, and resolves the ACTIVE cohort. Server-only.
 *
 * Scope model (this stage keeps the work-area trainee list owner-scoped, so the tree
 * stays consistent with what /workspace actually shows):
 *   - staff       → the cohorts they own trainees in, plus their assignment/default;
 *   - admin       → all non-archived cohorts in their course (management scope);
 *   - super_admin → all non-archived cohorts across every course.
 * The "unassigned" bucket (`hasUnassigned`) is owner-scoped for every role (the
 * caller's own trainees with no cohort), matching the owner-scoped work-area list.
 * Archived cohorts never appear in the tree. cohort is NOT an authz key.
 */

export type NavCohort = { id: string; name: string; status: CohortStatus; code: string | null };
export type NavCourse = {
  id: string;
  code: CourseType;
  name: string;
  cohorts: NavCohort[];
  /** Archived cohorts (managers only) — shown collapsed so they can be restored. */
  archivedCohorts: NavCohort[];
  hasUnassigned: boolean;
};
export type WorkspaceNav = {
  courses: NavCourse[];
  activeCohortId: string | null;
  /** Whether the viewer may create/rename/archive cohorts (admin/super). */
  canManageCohorts: boolean;
};

const toNav = (c: { id: string; name: string; status: CohortStatus; code: string | null }): NavCohort => ({
  id: c.id,
  name: c.name,
  status: c.status,
  code: c.code,
});

async function ownerHasUnassigned(ownerId: string, courseType: CourseType): Promise<boolean> {
  const exists = await Trainee.exists({ commanderId: ownerId, courseType, status: "active", cohortId: null });
  return Boolean(exists);
}

async function staffCohorts(
  ownerId: string,
  courseType: CourseType,
  extraIds: string[],
): Promise<NavCohort[]> {
  const owned = (await Trainee.distinct("cohortId", { commanderId: ownerId, courseType }))
    .filter(Boolean)
    .map((x) => String(x));
  const ids = [...new Set([...owned, ...extraIds.filter(Boolean)])].filter(isValidObjectId);
  if (ids.length === 0) return [];
  const docs = await Cohort.find({ _id: { $in: ids }, status: { $ne: "archived" } })
    .sort({ createdAt: -1, _id: -1 })
    .select("_id name status code")
    .lean<{ _id: unknown; name?: string; status?: string; code?: string | null }[]>();
  return docs.map((d) =>
    toNav({
      id: String(d._id),
      name: d.name ?? "",
      status: isCohortStatus(d.status) ? d.status : "planned",
      code: d.code ?? null,
    }),
  );
}

export async function getWorkspaceNav(
  account: Account,
  requestedCohortId?: string | null,
): Promise<WorkspaceNav> {
  await connectToDatabase();

  // Current assignment cohort (fallback + a nav entry even with no trainees yet).
  const asg = await UserAssignment.findOne({ userId: account.id, isCurrent: true })
    .select("cohortId")
    .lean<{ cohortId?: unknown } | null>();
  const assignmentId = asg?.cohortId ? String(asg.cohortId) : null;
  const defaultId = account.defaultCohortId ?? null;
  const canManageCohorts = isAdminRole(account.role);

  const archivedFor = async (courseId: string): Promise<NavCohort[]> =>
    canManageCohorts
      ? (await listCohorts({ courseId, status: "archived" })).map((k) => toNav({ id: k.id, name: k.name, status: k.status, code: k.code }))
      : [];

  const courses: NavCourse[] = [];

  if (account.role === "super_admin") {
    const all = await listCourses();
    for (const c of all) {
      const cohorts = (await listCohorts({ courseId: c.id })).map((k) =>
        toNav({ id: k.id, name: k.name, status: k.status, code: k.code }),
      );
      courses.push({
        id: c.id,
        code: c.code,
        name: c.name,
        cohorts,
        archivedCohorts: await archivedFor(c.id),
        hasUnassigned: false, // super_admin owns no scoped trainee list here
      });
    }
  } else if (account.courseType) {
    const courseId = account.courseId ?? (await courseIdForType(account.courseType));
    if (courseId) {
      const course = await getCourse(courseId);
      const name = course?.name ?? COURSE_LABELS[account.courseType];
      let cohorts: NavCohort[];
      if (account.role === "admin") {
        cohorts = (await listCohorts({ courseId })).map((k) =>
          toNav({ id: k.id, name: k.name, status: k.status, code: k.code }),
        );
      } else {
        cohorts = await staffCohorts(account.id, account.courseType, [assignmentId ?? "", defaultId ?? ""]);
      }
      courses.push({
        id: courseId,
        code: account.courseType,
        name,
        cohorts,
        archivedCohorts: await archivedFor(courseId),
        hasUnassigned: await ownerHasUnassigned(account.id, account.courseType),
      });
    }
  }

  const available = courses.flatMap((c) => c.cohorts.map((k) => k.id));
  const hasUnassigned = courses.some((c) => c.hasUnassigned);
  const activeCohortId = pickActiveCohort({
    requested: requestedCohortId,
    defaultId,
    assignmentId,
    available,
    hasUnassigned,
  });

  return { courses, activeCohortId, canManageCohorts };
}
