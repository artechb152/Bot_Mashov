import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminGetTrainee, adminListAttachments } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/trainees/[id]/attachments — metadata for any trainee's files.
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    if (!(await adminGetTrainee(auth.grant, id))) {
      return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    }
    const attachments = await adminListAttachments(auth.grant, id);
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("[api/admin/attachments] GET failed:", error);
    return NextResponse.json({ error: "טעינת הקבצים נכשלה." }, { status: 500 });
  }
}
