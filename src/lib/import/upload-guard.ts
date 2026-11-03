import { NextResponse } from "next/server";
import { isAllowedImportFile, MAX_IMPORT_FILE_BYTES } from "@/lib/files/trainee-import";

/**
 * Shared limits for the single-file import endpoints, so `preview` and `import`
 * can never disagree about what they will accept — a preview that succeeds must
 * always be followed by an import that succeeds.
 *
 * The import pipeline reads and stores documents (PDF/DOCX/TXT) via the file-storage
 * + text-extraction infra, so it uses that same allowlist + 10MB cap. Nothing
 * unbounded is ever buffered into memory or written to Mongo.
 */
export const MAX_IMPORT_BYTES = MAX_IMPORT_FILE_BYTES; // 10MB

export type ImportFileResult =
  | { ok: true; file: File }
  | { ok: false; response: NextResponse };

/** Reject an oversized body BEFORE the multipart form is buffered. */
export function guardContentLength(request: Request): NextResponse | null {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  // Allow ~1MB of multipart overhead on top of the file itself.
  if (contentLength > MAX_IMPORT_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "הקובץ גדול מדי (עד 10MB)." }, { status: 413 });
  }
  return null;
}

/** Pull the single "file" field out of a multipart form and validate it. */
export function takeImportFile(form: FormData): ImportFileResult {
  const file = form.get("file");

  if (!(file instanceof File)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "לא נבחר קובץ." }, { status: 400 }),
    };
  }
  if (file.size === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: `הקובץ "${file.name}" ריק.` }, { status: 400 }),
    };
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `הקובץ "${file.name}" גדול מדי (עד 10MB).` },
        { status: 400 },
      ),
    };
  }
  // Accept by MIME OR extension (browsers send empty/inconsistent types for some docs);
  // an unknown type with an unknown extension is rejected rather than skipped.
  if (!isAllowedImportFile(file.type || "", file.name)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `סוג הקובץ של "${file.name}" אינו נתמך. נתמכים: PDF, DOCX, TXT.` },
        { status: 400 },
      ),
    };
  }

  return { ok: true, file };
}
