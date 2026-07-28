import { NextResponse } from "next/server";
import { listCourses } from "@/lib/data/courses";
import { listCohorts } from "@/lib/data/cohorts";
import { listTeams } from "@/lib/data/teams";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public read endpoint for the staff signup form: the active org options a new
 * staff user may pick (course → active cohort → active team). Exposes only
 * non-sensitive org names/ids — no user data. The server re-validates the chosen
 * cohort/team relationships at signup regardless of what the client sends.
 */
export async function GET() {
  const [courses, cohorts, teams] = await Promise.all([
    listCourses(),
    listCohorts({ status: "active" }),
    listTeams({}),
  ]);

  return NextResponse.json({
    courses: courses
      .filter((c) => c.isActive)
      .map((c) => ({ code: c.code, name: c.name, courseId: c.id })),
    cohorts: cohorts.map((c) => ({
      id: c.id,
      courseId: c.courseId,
      courseType: c.courseType,
      name: c.name,
    })),
    teams: teams.map((t) => ({ id: t.id, cohortId: t.cohortId, name: t.name })),
  });
}
