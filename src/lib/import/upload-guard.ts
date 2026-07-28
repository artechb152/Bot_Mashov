import { NextResponse } from "next/server";
import { isAllowedMime, MAX_ATTACHMENT_BYTES } from "@/lib/data/attachments";

/**
 * Shared limits for the single-file import endpoints, so `preview` and `import`
 * can never disagree about what they will accept — a preview that succeeds must
 * always be followed by an import that succeeds.
 *
 * Reuses the same 5MB cap and MIME allowlist as ordinary trainee attachments,
 * because the imported file is stored as exactly that. Nothing unbounded is ever
 * buffered into memory or written to Mongo.
 */
export const MAX_IMPORT_BYTES = MAX_ATTACHMENT_BYTES; // 5MB

export type ImportFileResult =
  | { ok: true; file: File }
  | { ok: false; response: NextResponse };

/** Reject an oversized body BEFORE the multipart form is buffered. */
export function guardContentLength(request: Request): NextResponse | null {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  // Allow ~1MB of multipart overhead on top of the file itself.
  if (contentLength > MAX_IMPORT_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "הקובץ גדול מדי (עד 5MB)." }, { status: 413 });
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
        { error: `הקובץ "${file.name}" גדול מדי (עד 5MB).` },
        { status: 400 },
      ),
    };
  }
  // An empty/missing Content-Type is untrusted — reject rather than skip the check.
  if (!isAllowedMime(file.type || "")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `סוג הקובץ של "${file.name}" אינו נתמך.` },
        { status: 400 },
      ),
    };
  }

  return { ok: true, file };
}
