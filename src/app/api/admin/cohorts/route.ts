import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminListCohorts, adminCreateCohort } from "@/lib/data/org-admin";
import { isCohortStatus } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/cohorts — cohorts in the admin's course (all for super-admin).
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ cohorts: await adminListCohorts(auth.grant) });
}

// POST /api/admin/cohorts — create a cohort in scope.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const result = await adminCreateCohort(auth.grant, {
    courseId: typeof b.courseId === "string" ? b.courseId : undefined,
    name: typeof b.name === "string" ? b.name : "",
    code: typeof b.code === "string" ? b.code : undefined,
    status: isCohortStatus(b.status) ? b.status : undefined,
  });
  if (result.ok) return NextResponse.json({ cohort: result.cohort }, { status: 201 });
  const map: Record<string, string> = {
    invalid_course: "הקורס שנבחר אינו תקין.",
    invalid_input: "יש להזין שם מחזור.",
    duplicate: "מחזור עם קוד זה כבר קיים בקורס.",
    not_found: "לא נמצא.",
  };
  return NextResponse.json({ error: map[result.reason] ?? "יצירת המחזור נכשלה." }, { status: 400 });
}
