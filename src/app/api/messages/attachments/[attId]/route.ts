import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { getMessageAttachmentForUser } from "@/lib/data/messages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ attId: string }> };

// GET /api/messages/attachments/[attId] — download a message attachment. Gated by
// THREAD PARTICIPATION (a non-participant gets a generic 404). Never a public URL.
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const { attId } = await params;

  const file = await getMessageAttachmentForUser(auth.grant.userId, attId);
  if (!file) return NextResponse.json({ error: "הקובץ לא נמצא." }, { status: 404 });

  const bytes = new Uint8Array(file.content);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
