import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminGetTrainee, adminUpdateTrainee } from "@/lib/data/admin";
import { parseTraineeBody } from "@/lib/validation/trainee";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/trainees/[id] — any trainee, any owner/course (admin only).
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const trainee = await adminGetTrainee(auth.grant, id);
    if (!trainee) return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    return NextResponse.json({ trainee });
  } catch (error) {
    console.error("[api/admin/trainees/:id] GET failed:", error);
    return NextResponse.json({ error: "טעינת החניך נכשלה." }, { status: 500 });
  }
}

// PATCH /api/admin/trainees/[id] — edit content only. Ownership + course are
// never in the patch shape, so an admin edit can't re-home the trainee.
export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const parsed = parseTraineeBody(body, true);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.errors.join(" "), errors: parsed.errors },
      { status: 400 },
    );
  }

  try {
    const trainee = await adminUpdateTrainee(auth.grant, id, parsed.data);
    if (!trainee) return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    console.log(`[api/admin/trainees/:id] updated ${id} → 200`);
    return NextResponse.json({ trainee });
  } catch (error) {
    console.error("[api/admin/trainees/:id] PATCH failed:", error);
    return NextResponse.json({ error: "עדכון החניך נכשל." }, { status: 500 });
  }
}
