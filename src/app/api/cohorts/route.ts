import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth/account";
import { listCohorts } from "@/lib/data/cohorts";
import { courseIdForType } from "@/lib/data/courses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cohorts — the caller's SELECTABLE cohorts (non-archived) for the trainee
 * create/edit cohort picker. Scoped to the caller's course (all courses for a
 * super_admin). Read-only, low-sensitivity (names only); management stays in the
 * admin/system cohort pages.
 */
export async function GET() {
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (account.status !== "active") return NextResponse.json({ error: "החשבון אינו פעיל." }, { status: 403 });

  try {
    let courseId: string | undefined;
    if (account.role !== "super_admin") {
      if (!account.courseType) return NextResponse.json({ cohorts: [] });
      courseId = account.courseId ?? (await courseIdForType(account.courseType)) ?? undefined;
      if (!courseId) return NextResponse.json({ cohorts: [] });
    }
    const cohorts = (await listCohorts(courseId ? { courseId } : {})).map((c) => ({
      id: c.id,
      name: c.name,
      courseType: c.courseType,
    }));
    return NextResponse.json({ cohorts });
  } catch (error) {
    console.error("[api/cohorts] GET failed:", error);
    return NextResponse.json({ error: "טעינת המחזורים נכשלה." }, { status: 500 });
  }
}
