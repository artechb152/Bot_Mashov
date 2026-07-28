import { NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/require-scope";
import { getTrainee } from "@/lib/data/trainees";
import {
  createAttachment,
  isAllowedMime,
  listAttachments,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/data/attachments";
import { parseTraineeFile } from "@/lib/import/parse-trainee-file";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILES_PER_REQUEST = 10;
const MAX_TOTAL_BYTES = MAX_ATTACHMENT_BYTES * MAX_FILES_PER_REQUEST; // 50MB

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trainees/[id]/attachments — metadata for a trainee in the caller's scope.
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    if (!(await getTrainee(id, auth.scope))) {
      return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    }
    const attachments = await listAttachments(id, auth.scope);
    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("[api/attachments] GET failed:", error);
    return NextResponse.json({ error: "טעינת הקבצים נכשלה." }, { status: 500 });
  }
}

// POST /api/trainees/[id]/attachments — upload one or more files (multipart form).
export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  try {
    // Reject an oversized body up front (before buffering the whole multipart form).
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_TOTAL_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: "הבקשה גדולה מדי." }, { status: 413 });
    }

    if (!(await getTrainee(id, auth.scope))) {
      return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
    }

    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: "לא נבחרו קבצים." }, { status: 400 });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `ניתן להעלות עד ${MAX_FILES_PER_REQUEST} קבצים בבת אחת.` },
        { status: 400 },
      );
    }

    let totalBytes = 0;
    for (const file of files) {
      if (file.size === 0) {
        return NextResponse.json({ error: `הקובץ "${file.name}" ריק.` }, { status: 400 });
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json(
          { error: `הקובץ "${file.name}" גדול מדי (עד 5MB).` },
          { status: 400 },
        );
      }
      // Empty/missing Content-Type is untrusted — reject rather than skip the check.
      if (!isAllowedMime(file.type || "")) {
        return NextResponse.json(
          { error: `סוג הקובץ של "${file.name}" אינו נתמך.` },
          { status: 400 },
        );
      }
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json({ error: "סך הקבצים גדול מדי." }, { status: 400 });
      }
    }

    const created = [];
    for (const file of files) {
      const content = Buffer.from(await file.arrayBuffer());
      // Pull out plain text where the format allows it (txt/md/csv/json), so
      // documents on file are already usable by the future bot. Empty for
      // formats we do not parse; never fatal.
      const { extractedText } = parseTraineeFile(content, file.type, file.name);
      // ownerId + courseType are taken from the session scope, not the request.
      const att = await createAttachment(id, auth.scope, {
        originalName: file.name || "קובץ",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        content,
        extractedText,
      });
      if (!att) return NextResponse.json({ error: "החניך לא נמצא." }, { status: 404 });
      created.push(att);
    }

    return NextResponse.json({ attachments: created }, { status: 201 });
  } catch (error) {
    console.error("[api/attachments] POST failed:", error);
    return NextResponse.json({ error: "העלאת הקבצים נכשלה." }, { status: 500 });
  }
}
