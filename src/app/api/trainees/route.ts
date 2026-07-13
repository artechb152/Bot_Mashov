import { NextResponse } from "next/server";
import { createTrainee, listTrainees, type TraineeInput } from "@/lib/data/trainees";
import { parseTraineeBody } from "@/lib/validation/trainee";
import { getCurrentUser } from "@/lib/auth/current-user";

// Always run on-demand against the database (never statically cached / prerendered).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trainees — the current user's trainees only.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  try {
    const trainees = await listTrainees(user.id);
    return NextResponse.json({ trainees });
  } catch (error) {
    console.error("[api/trainees] GET failed:", error);
    return NextResponse.json({ error: "טעינת החניכים נכשלה." }, { status: 500 });
  }
}

// POST /api/trainees — create a trainee owned by the current user.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const parsed = parseTraineeBody(body, false);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
  }

  try {
    const trainee = await createTrainee(parsed.data as TraineeInput, user.id);
    console.log(`[api/trainees] created ${trainee.id} → 201`);
    return NextResponse.json({ trainee }, { status: 201 });
  } catch (error) {
    console.error("[api/trainees] POST failed:", error);
    return NextResponse.json({ error: "יצירת החניך נכשלה." }, { status: 500 });
  }
}
