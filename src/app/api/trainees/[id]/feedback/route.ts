import { NextResponse } from "next/server";
import { requireTraineeAccess } from "@/lib/auth/access";
import { createFeedback, listFeedback, type FeedbackInput } from "@/lib/data/feedback";
import { parseFeedbackBody } from "@/lib/validation/feedback";
import {
  isAllowedFeedbackFile,
  saveFeedbackAttachment,
  MAX_FEEDBACK_FILE_BYTES,
} from "@/lib/files/feedback-attachments";
import { isFeedbackType, type CourseType } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Per-trainee feedback. Read requires VIEW access; create requires a WRITE level
 * (owner / edit-grant / course admin / super_admin / root). A feedback entry may be
 * TEXT (JSON body) or FILE-based (multipart). For files the binary is stored via the
 * storage backend and only metadata + extracted text is persisted — never the binary.
 */

// GET /api/trainees/[id]/feedback — chronological list (active; ?includeArchived=1).
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await requireTraineeAccess(id);
  if (!access.ok) return access.response;

  try {
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
    const feedback = await listFeedback(id, { includeArchived });
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("[api/trainees/:id/feedback] GET failed:", error);
    return NextResponse.json({ error: "טעינת המשובים נכשלה." }, { status: 500 });
  }
}

// POST /api/trainees/[id]/feedback — create text OR file feedback.
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await requireTraineeAccess(id, { write: true });
  if (!access.ok) return access.response;

  const ctx = {
    authorId: access.actorId,
    commanderId: access.trainee.commanderId,
    courseType: access.trainee.courseType as CourseType | null,
  };

  const contentType = request.headers.get("content-type") ?? "";

  // --- File (multipart) path --------------------------------------------------
  if (contentType.includes("multipart/form-data")) {
    try {
      const contentLength = Number(request.headers.get("content-length") ?? 0);
      if (contentLength > MAX_FEEDBACK_FILE_BYTES + 1024 * 1024) {
        return NextResponse.json({ error: "הבקשה גדולה מדי." }, { status: 413 });
      }
      const form = await request.formData();
      const title = String(form.get("title") ?? "").trim();
      const feedbackType = String(form.get("feedbackType") ?? "");
      const rawText = String(form.get("rawText") ?? "").trim();
      const selectedAction = String(form.get("selectedAction") ?? "").trim();
      const file = form.get("file");

      if (!isFeedbackType(feedbackType)) {
        return NextResponse.json({ error: "סוג המשוב אינו תקין." }, { status: 400 });
      }
      const hasFile = file instanceof File && file.size > 0;
      if (!hasFile && !rawText) {
        return NextResponse.json({ error: "יש לצרף קובץ או להזין טקסט." }, { status: 400 });
      }

      let attachment;
      if (hasFile) {
        const f = file as File;
        if (f.size > MAX_FEEDBACK_FILE_BYTES) {
          return NextResponse.json({ error: "הקובץ גדול מדי (עד 10MB)." }, { status: 400 });
        }
        if (!isAllowedFeedbackFile(f.type || "", f.name)) {
          return NextResponse.json({ error: "סוג הקובץ אינו נתמך (PDF / DOCX / TXT)." }, { status: 400 });
        }
        const bytes = Buffer.from(await f.arrayBuffer());
        attachment = await saveFeedbackAttachment(id, { name: f.name, type: f.type, bytes }, access.actorId);
      }

      const created = await createFeedback(
        id,
        ctx,
        { feedbackType, title, rawText, selectedAction } as FeedbackInput,
        attachment,
      );
      if (!created) return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
      return NextResponse.json({ feedback: created }, { status: 201 });
    } catch (error) {
      console.error("[api/trainees/:id/feedback] POST (file) failed:", error);
      return NextResponse.json({ error: "שמירת המשוב נכשלה." }, { status: 500 });
    }
  }

  // --- Text (JSON) path -------------------------------------------------------
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const parsed = parseFeedbackBody(body, false);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
  }

  try {
    const created = await createFeedback(id, ctx, parsed.data as FeedbackInput);
    if (!created) return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    return NextResponse.json({ feedback: created }, { status: 201 });
  } catch (error) {
    console.error("[api/trainees/:id/feedback] POST failed:", error);
    return NextResponse.json({ error: "שמירת המשוב נכשלה." }, { status: 500 });
  }
}
