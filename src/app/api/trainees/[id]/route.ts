import { NextResponse } from "next/server";
import { deleteTrainee, getTrainee, updateTrainee } from "@/lib/data/trainees";
import { parseTraineeBody } from "@/lib/validation/trainee";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In Next.js 15 the dynamic route context `params` is a Promise and must be awaited.
type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trainees/[id] — only if it belongs to the current user.
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;
  try {
    const trainee = await getTrainee(id, user.id);
    if (!trainee) {
      return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    }
    return NextResponse.json({ trainee });
  } catch (error) {
    console.error("[api/trainees/:id] GET failed:", error);
    return NextResponse.json({ error: "טעינת החניך נכשלה." }, { status: 500 });
  }
}

// PATCH /api/trainees/[id] — only if it belongs to the current user.
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const parsed = parseTraineeBody(body, true);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
  }

  try {
    const trainee = await updateTrainee(id, parsed.data, user.id);
    if (!trainee) {
      return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    }
    console.log(`[api/trainees/:id] updated ${id} → 200`);
    return NextResponse.json({ trainee });
  } catch (error) {
    console.error("[api/trainees/:id] PATCH failed:", error);
    return NextResponse.json({ error: "עדכון החניך נכשל." }, { status: 500 });
  }
}

// DELETE /api/trainees/[id] — only if it belongs to the current user.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;
  try {
    const deleted = await deleteTrainee(id, user.id);
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
