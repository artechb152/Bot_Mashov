import { NextResponse } from "next/server";
import { deleteTrainee, readTraineeById, updateTraineeById } from "@/lib/data/trainees";
import { parseTraineeBody } from "@/lib/validation/trainee";
import { requireScope } from "@/lib/auth/require-scope";
import { requireTraineeAccess } from "@/lib/auth/access";
import { isCohortInCourse } from "@/lib/data/cohorts";
import { isCourseType } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In Next.js 15 the dynamic route context `params` is a Promise and must be awaited.
type RouteContext = { params: Promise<{ id: string }> };

/**
 * Read + write go through `requireTraineeAccess` — the unified gate that allows an
 * OWNER, an active view/edit GRANT holder, a course admin, or a super-admin, and
 * enforces the cohort lock. An unauthorized id returns 404 (indistinguishable from
 * missing), so the endpoint cannot probe for others' data. DELETE stays owner-only.
 */

// GET /api/trainees/[id]
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await requireTraineeAccess(id);
  if (!access.ok) return access.response;

  try {
    const trainee = await readTraineeById(id);
    if (!trainee) return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    return NextResponse.json({ trainee });
  } catch (error) {
    console.error("[api/trainees/:id] GET failed:", error);
    return NextResponse.json({ error: "טעינת החניך נכשלה." }, { status: 500 });
  }
}

// PATCH /api/trainees/[id] — owner or an active EDIT grant (or admin/super).
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await requireTraineeAccess(id, { write: true });
  if (!access.ok) return access.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  // A cohort change on its own is a valid update (even with no other fields).
  const rawCohort = (body as { cohortId?: unknown }).cohortId;
  const hasCohort = typeof rawCohort === "string";

  const parsed = parseTraineeBody(body, true);
  if (!parsed.ok) {
    const onlyEmpty = parsed.errors.length === 1 && parsed.errors[0] === "לא נשלחו שדות לעדכון.";
    if (!(hasCohort && onlyEmpty)) {
      return NextResponse.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
    }
  }
  const data = parsed.ok ? parsed.data : {};

  // Optional cohort change — validated against the TRAINEE's course. "" clears it.
  const org: { cohortId?: string | null } = {};
  if (hasCohort) {
    if ((rawCohort as string).trim() === "") {
      org.cohortId = null;
    } else {
      const courseType = access.trainee.courseType;
      if (!isCourseType(courseType) || !(await isCohortInCourse(rawCohort as string, courseType))) {
        return NextResponse.json({ error: "המחזור שנבחר אינו תקין." }, { status: 400 });
      }
      org.cohortId = rawCohort as string;
    }
  }

  try {
    const trainee = await updateTraineeById(id, data, access.actorId, org);
    if (!trainee) return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    console.log(`[api/trainees/:id] updated ${id} → 200`);
    return NextResponse.json({ trainee });
  } catch (error) {
    console.error("[api/trainees/:id] PATCH failed:", error);
    return NextResponse.json({ error: "עדכון החניך נכשל." }, { status: 500 });
  }
}

// DELETE /api/trainees/[id]
export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    const deleted = await deleteTrainee(id, auth.scope);
    if (!deleted) {
      return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    }
    console.log(`[api/trainees/:id] deleted ${id} → 200`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/trainees/:id] DELETE failed:", error);
    return NextResponse.json({ error: "מחיקת החניך נכשלה." }, { status: 500 });
  }
}
