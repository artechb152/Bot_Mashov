import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { deleteAttachment, getAttachment } from "@/lib/data/attachments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; attId: string }> };

// GET /api/trainees/[id]/attachments/[attId] — download the file (owner-scoped).
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { attId } = await params;
  try {
    const file = await getAttachment(attId, user.id);
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

// DELETE /api/trainees/[id]/attachments/[attId] — remove the file (owner-scoped).
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { attId } = await params;
  try {
    const ok = await deleteAttachment(attId, user.id);
    if (!ok) return NextResponse.json({ error: "הקובץ לא נמצא." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/attachments/:attId] DELETE failed:", error);
    return NextResponse.json({ error: "מחיקת הקובץ נכשלה." }, { status: 500 });
  }
}
