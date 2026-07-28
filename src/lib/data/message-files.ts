import type { MessageFileInput } from "@/lib/data/messages";

/**
 * Validation for message attachments: allowlisted MIME types, size cap, file count
 * cap. Filenames are only ever echoed via encoded Content-Disposition (no
 * filesystem path is built), so there is no path-traversal surface. Server-only.
 */
const MAX_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_FILES = 5;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

// Extension allowlist mirrors the MIME allowlist (§28) — validate BOTH so a benign
// MIME string can't smuggle an unexpected extension, and vice-versa.
const ALLOWED_EXT = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export type TakeFilesResult = { ok: true; files: MessageFileInput[] } | { ok: false; error: string };

export async function takeMessageFiles(form: FormData): Promise<TakeFilesResult> {
  const raw = form.getAll("files").filter((f): f is File => f instanceof File);
  if (raw.length > MAX_FILES) return { ok: false, error: `ניתן לצרף עד ${MAX_FILES} קבצים.` };

  const files: MessageFileInput[] = [];
  let total = 0;
  for (const f of raw) {
    if (f.size === 0) continue;
    if (f.size > MAX_BYTES) return { ok: false, error: "קובץ חורג מהמגבלה (5MB)." };
    if (!f.type || !ALLOWED_MIME.has(f.type)) return { ok: false, error: "סוג קובץ לא נתמך." };
    // Sanitize the filename (strip any path separators — defense in depth even though
    // no filesystem path is ever built) and validate its extension.
    const safeName = (f.name || "קובץ").replace(/[\\/]/g, "_").slice(0, 200);
    if (!ALLOWED_EXT.has(extensionOf(safeName))) return { ok: false, error: "סיומת קובץ לא נתמכת." };
    total += f.size;
    if (total > MAX_FILES * MAX_BYTES) return { ok: false, error: "סך הקבצים חורג מהמגבלה." };
    const content = Buffer.from(await f.arrayBuffer());
    files.push({ originalName: safeName, mimeType: f.type, size: f.size, content });
  }
  return { ok: true, files };
}
