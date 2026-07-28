import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { transferTraineeOwnership } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/trainees/[id]/transfer — reassign a trainee to another staff
// owner in the same course. Body: { toUserId, reason }.
export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const toUserId = typeof b.toUserId === "string" ? b.toUserId : "";
  const reason = typeof b.reason === "string" ? b.reason : "";

  const result = await transferTraineeOwnership(auth.grant, id, toUserId, reason);
  if (result.ok) return NextResponse.json({ trainee: result.trainee });

  const map: Record<string, [string, number]> = {
    not_found: ["החניך לא נמצא.", 404],
    invalid_target: ["יש לבחור מפקד יעד תקין מאותו הקורס.", 400],
    out_of_scope: ["אין לך הרשאה לצפות או לבצע פעולה זו.", 403],
    invalid_input: ["יש להזין סיבה להעברה.", 400],
  };
  const [msg, status] = map[result.reason] ?? ["ההעברה נכשלה.", 400];
  return NextResponse.json({ error: msg }, { status });
}
