import { NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/require-scope";
import { requireTraineeAccess } from "@/lib/auth/access";
import { deleteAttachment, readAttachmentContentById } from "@/lib/data/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; attId: string }> };

/**
 * Download is gated by `requireTraineeAccess` (owner, active grant, course admin,
 * super-admin) and always ties the attachment to its trainee (no attId-swap).
 * Delete stays OWNER-scoped (a view/edit grant never deletes documents).
 */

// GET /api/trainees/[id]/attachments/[attId] — download the file.
export async function GET(_request: Request, { params }: RouteContext) {
  const { id, attId } = await params;
  const access = await requireTraineeAccess(id);
  if (!access.ok) return access.response;

  try {
    const file = await readAttachmentContentById(id, attId);
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
    console.error("[api/attachments/:attId] GET failed:", error);
    return NextResponse.json({ error: "הורדת הקובץ נכשלה." }, { status: 500 });
  }
}

// DELETE /api/trainees/[id]/attachments/[attId] — remove the file.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;
  const { id, attId } = await params;

  try {
    const ok = await deleteAttachment(id, attId, auth.scope);
    if (!ok) return NextResponse.json({ error: "הקובץ לא נמצא." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/attachments/:attId] DELETE failed:", error);
    return NextResponse.json({ error: "מחיקת הקובץ נכשלה." }, { status: 500 });
  }
}
