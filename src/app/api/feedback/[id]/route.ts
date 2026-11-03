import { NextResponse } from "next/server";
import { requireFeedbackWrite } from "@/lib/auth/feedback-access";
import { updateFeedback } from "@/lib/data/feedback";
import { parseFeedbackBody } from "@/lib/validation/feedback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/feedback/[id] — edit content. Author, owner, edit-grant, course admin,
// super_admin, or root (enforced by requireFeedbackWrite). Unauthorized → 404.
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireFeedbackWrite(id);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const parsed = parseFeedbackBody(body, true);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
  }

  try {
    const updated = await updateFeedback(id, parsed.data, auth.actorId);
    if (!updated) return NextResponse.json({ error: "המשוב לא נמצא." }, { status: 404 });
    return NextResponse.json({ feedback: updated });
  } catch (error) {
    console.error("[api/feedback/:id] PATCH failed:", error);
    return NextResponse.json({ error: "עדכון המשוב נכשל." }, { status: 500 });
  }
}
