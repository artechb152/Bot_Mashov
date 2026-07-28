import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/require-active";
import { createThread, listThreads, type Folder } from "@/lib/data/messages";
import { resolveRecipients, type RecipientSpec } from "@/lib/data/recipients";
import { takeMessageFiles } from "@/lib/data/message-files";
import { writeAudit } from "@/lib/data/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LARGE_BROADCAST = 15;

// GET /api/messages?folder=inbox|sent|archive
export async function GET(request: Request) {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;
  const folderParam = new URL(request.url).searchParams.get("folder");
  const folder: Folder = folderParam === "sent" || folderParam === "archive" ? folderParam : "inbox";
  return NextResponse.json({ threads: await listThreads(auth.account, folder) });
}

// POST /api/messages — send a new thread (multipart). Fields: subject, body,
// spec (JSON {userIds?, groups?}), relatedTraineeIds (JSON string[]), confirm.
// When the resolved recipient count is large and confirm !== "true", returns 409
// with { needsConfirm, count } so the client can confirm the broadcast.
export async function POST(request: Request) {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "");
  let spec: RecipientSpec = {};
  try {
    const raw = form.get("spec");
    if (typeof raw === "string" && raw) spec = JSON.parse(raw) as RecipientSpec;
  } catch {
    return NextResponse.json({ error: "יעדים לא תקינים." }, { status: 400 });
  }
  let relatedTraineeIds: string[] = [];
  try {
    const raw = form.get("relatedTraineeIds");
    if (typeof raw === "string" && raw) relatedTraineeIds = JSON.parse(raw) as string[];
  } catch {
    relatedTraineeIds = [];
  }
  const confirm = String(form.get("confirm") ?? "") === "true";

  // Preview count to enforce the large-broadcast confirmation.
  const preview = await resolveRecipients(auth.account, spec);
  if (!preview.ok) return NextResponse.json({ error: preview.error }, { status: 403 });
  if (preview.total === 0) return NextResponse.json({ error: "יש לבחור לפחות נמען אחד." }, { status: 400 });
  if (preview.total >= LARGE_BROADCAST && !confirm) {
    return NextResponse.json({ needsConfirm: true, count: preview.total }, { status: 409 });
  }

  const picked = await takeMessageFiles(form);
  if (!picked.ok) return NextResponse.json({ error: picked.error }, { status: 400 });

  const result = await createThread(auth.account, {
    subject,
    body,
    spec,
    files: picked.files,
    relatedTraineeIds,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Audit broadcast creation (metadata only — never the message body).
  if (result.recipientCount >= LARGE_BROADCAST) {
    await writeAudit({
      actorId: auth.account.id,
      action: "message.broadcast_created",
      targetType: "message",
      targetId: result.threadId,
      metadata: { recipientCount: result.recipientCount },
    });
  }

  return NextResponse.json({ threadId: result.threadId, recipientCount: result.recipientCount }, { status: 201 });
}
