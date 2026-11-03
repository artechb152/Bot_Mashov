import { NextResponse } from "next/server";
import { createTrainee, listTrainees, type TraineeInput } from "@/lib/data/trainees";
import { parseTraineeBody } from "@/lib/validation/trainee";
import { requireScope } from "@/lib/auth/require-scope";
import { getCurrentAssignment } from "@/lib/data/assignments";
import { isCohortInCourse } from "@/lib/data/cohorts";

// Always run on-demand against the database (never statically cached / prerendered).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trainees — the current user's trainees, in their course only.
export async function GET() {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  try {
    const trainees = await listTrainees(auth.scope);
    return NextResponse.json({ trainees });
  } catch (error) {
    console.error("[api/trainees] GET failed:", error);
    return NextResponse.json({ error: "טעינת החניכים נכשלה." }, { status: 500 });
  }
}

// POST /api/trainees — create a trainee owned by the current user, in their course.
export async function POST(request: Request) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const parsed = parseTraineeBody(body, false);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.errors.join(" "), errors: parsed.errors },
      { status: 400 },
    );
  }

  // Optional client-chosen cohort — must belong to the user's course (else 400).
  // "" clears it ("ללא שיוך למחזור"); omitted → fall back to the assignment cohort.
  const rawCohort = (body as { cohortId?: unknown }).cohortId;
  let chosenCohortId: string | null | undefined;
  if (typeof rawCohort === "string") {
    if (rawCohort.trim() === "") {
      chosenCohortId = null;
    } else if (await isCohortInCourse(rawCohort, auth.scope.courseType)) {
      chosenCohortId = rawCohort;
    } else {
      return NextResponse.json({ error: "המחזור שנבחר אינו תקין." }, { status: 400 });
    }
  }

  try {
    // ownerId + courseType come from the session. Cohort/team default to the staff
    // user's CURRENT assignment (server-derived); a valid client-chosen cohort in the
    // same course may override the cohort (team stays from the assignment).
    const assignment = await getCurrentAssignment(auth.scope.ownerId);
    const trainee = await createTrainee(parsed.data as TraineeInput, auth.scope, {
      cohortId: chosenCohortId !== undefined ? chosenCohortId : assignment?.cohortId ?? null,
      teamId: assignment?.teamId ?? null,
    });
    console.log(`[api/trainees] created ${trainee.id} → 201`);
    return NextResponse.json({ trainee }, { status: 201 });
  } catch (error) {
    console.error("[api/trainees] POST failed:", error);
    return NextResponse.json({ error: "יצירת החניך נכשלה." }, { status: 500 });
  }
}
