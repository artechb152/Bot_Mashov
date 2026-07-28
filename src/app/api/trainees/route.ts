import { NextResponse } from "next/server";
import { createTrainee, listTrainees, type TraineeInput } from "@/lib/data/trainees";
import { parseTraineeBody } from "@/lib/validation/trainee";
import { requireScope } from "@/lib/auth/require-scope";
import { getCurrentAssignment } from "@/lib/data/assignments";

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

  try {
    // ownerId + courseType come from the session; cohort/team come from the staff
    // user's CURRENT assignment (server-derived) — never from the request body.
    const assignment = await getCurrentAssignment(auth.scope.ownerId);
    const trainee = await createTrainee(parsed.data as TraineeInput, auth.scope, {
      cohortId: assignment?.cohortId ?? null,
      teamId: assignment?.teamId ?? null,
    });
    console.log(`[api/trainees] created ${trainee.id} → 201`);
    return NextResponse.json({ trainee }, { status: 201 });
  } catch (error) {
    console.error("[api/trainees] POST failed:", error);
    return NextResponse.json({ error: "יצירת החניך נכשלה." }, { status: 500 });
  }
}
