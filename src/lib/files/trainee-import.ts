import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/storage";
import { extractText, type ExtractionResult, type ExtractionStatus } from "./extract-text";
import { FEEDBACK_ALLOWED_MIME, MAX_FEEDBACK_FILE_BYTES } from "./feedback-attachments";

/**
 * Trainee "import from file" storage + extraction. **Server-only.**
 *
 * Supported document types: PDF, DOCX, TXT (+ md/csv as plain text) — the same
 * allowlist as feedback attachments. The binary is written to {@link getStorage}
 * (never to Mongo); only a metadata reference (`storageKey`, size, mime, extraction
 * status) is persisted on the trainee. Text extraction reuses `extractText`
 * (pdf-parse / mammoth) and NEVER throws — an unreadable/scanned file yields an
 * empty/unsupported/failed status, which the caller surfaces as "type it in by hand"
 * (no OCR in this stage, no fabricated content).
 */

export const IMPORT_ALLOWED_MIME = FEEDBACK_ALLOWED_MIME;
export const MAX_IMPORT_FILE_BYTES = MAX_FEEDBACK_FILE_BYTES; // 10MB

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};

function extOf(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

/** Whether a file (by mime OR extension) is an allowed import document. */
export function isAllowedImportFile(mimeType: string, filename: string): boolean {
  if (IMPORT_ALLOWED_MIME.has((mimeType || "").toLowerCase())) return true;
  return Boolean(EXT_TO_MIME[extOf(filename)]);
}

function safeExt(mimeType: string, filename: string): string {
  const ext = extOf(filename);
  if (ext) return ext;
  const found = Object.entries(EXT_TO_MIME).find(([, m]) => m === (mimeType || "").toLowerCase());
  return found ? found[0] : "bin";
}

export function resolveMime(mimeType: string, filename: string): string {
  return (mimeType || "").toLowerCase() || EXT_TO_MIME[extOf(filename)] || "application/octet-stream";
}

/** Read a file's text for the preview step. Creates nothing (no storage write). */
export async function extractImportText(
  bytes: Buffer,
  mimeType: string,
  filename: string,
): Promise<ExtractionResult> {
  return extractText(bytes, resolveMime(mimeType, filename), filename);
}

/** Metadata referencing an imported source file (persisted on the trainee doc). */
export type StoredImportFile = {
  originalFileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  extractionStatus: ExtractionStatus;
};

/**
 * Store the source file in FileStorage and return its metadata reference. The binary
 * never enters Mongo. `extractionStatus` is recorded for traceability. The caller has
 * already authorized the creator + validated size/type.
 */
export async function storeImportFile(file: {
  name: string;
  type: string;
  bytes: Buffer;
}): Promise<StoredImportFile> {
  const mimeType = resolveMime(file.type, file.name);
  const storageKey = `trainee-import/${randomUUID()}.${safeExt(file.type, file.name)}`;
  await getStorage().put(storageKey, file.bytes, mimeType);
  const { status } = await extractText(file.bytes, mimeType, file.name);
  return {
    originalFileName: file.name || "קובץ",
    mimeType,
    size: file.bytes.length,
    storageKey,
    extractionStatus: status,
  };
}

/** Best-effort cleanup of a stored import file (used on a compensating rollback). */
export async function deleteImportFile(storageKey: string): Promise<void> {
  try {
    await getStorage().delete(storageKey);
  } catch {
    /* best-effort — a leaked temp blob is preferable to a thrown rollback */
  }
}
