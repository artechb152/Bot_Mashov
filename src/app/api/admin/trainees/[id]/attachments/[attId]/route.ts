import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminDeleteAttachment, adminGetAttachment } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; attId: string }> };

// GET /api/admin/trainees/[id]/attachments/[attId] — download any file (admin only).
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id, attId } = await params;
  try {
    const file = await adminGetAttachment(auth.grant, id, attId);
    if (!file) return NextResponse.json({ error: "הקובץ לא נמצא." }, { status: 404 });

    const body = new Uint8Array(file.content);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[api/admin/attachments/:attId] GET failed:", error);
    return NextResponse.json({ error: "הורדת הקובץ נכשלה." }, { status: 500 });
  }
}

// DELETE /api/admin/trainees/[id]/attachments/[attId] — remove any file (admin only).
export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id, attId } = await params;
  try {
    const ok = await adminDeleteAttachment(auth.grant, id, attId);
    if (!ok) return NextResponse.json({ error: "הקובץ לא נמצא." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/attachments/:attId] DELETE failed:", error);
    return NextResponse.json({ error: "מחיקת הקובץ נכשלה." }, { status: 500 });
  }
}
