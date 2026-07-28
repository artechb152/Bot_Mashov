import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/require-active";
import { getThreadForUser, reply } from "@/lib/data/messages";
import { takeMessageFiles } from "@/lib/data/message-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ threadId: string }> };

// GET /api/messages/[threadId] — the thread (participant-gated; marks read).
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;
  const { threadId } = await params;
  const thread = await getThreadForUser(auth.account, threadId);
  if (!thread) return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 404 });
  return NextResponse.json({ thread });
}

// POST /api/messages/[threadId] — reply (multipart: body, files). Participant-gated.
export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;
  const { threadId } = await params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const body = String(form.get("body") ?? "");
  const picked = await takeMessageFiles(form);
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 });
  if (!body.trim() && picked.files.length === 0) {
    return NextResponse.json({ error: "יש להזין תוכן להודעה." }, { status: 400 });
  }

  const result = await reply(auth.account, threadId, body, picked.files);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
