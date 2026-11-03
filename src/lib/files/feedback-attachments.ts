import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/storage";
import { extractText, type ExtractionStatus } from "./extract-text";

/**
 * Feedback file attachments (documents attached to a feedback entry). **Server-only.**
 * Supported document types for this stage: PDF, DOCX, TXT (+ md/csv as plain text).
 * The binary is written to {@link getStorage}; the DB stores only metadata + the
 * extracted text.
 */

export const MAX_FEEDBACK_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export const FEEDBACK_ALLOWED_MIME = new Set<string>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
};

/** Metadata persisted on the Feedback document (never the binary). */
export type NewFeedbackAttachment = {
  originalFileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  extractedText: string;
  extractionStatus: ExtractionStatus;
  uploadedBy: string;
};

function extOf(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

/** Whether a file (by mime OR extension) is an allowed feedback document. */
export function isAllowedFeedbackFile(mimeType: string, filename: string): boolean {
  if (FEEDBACK_ALLOWED_MIME.has((mimeType || "").toLowerCase())) return true;
  return Boolean(EXT_TO_MIME[extOf(filename)]);
}

function safeExt(mimeType: string, filename: string): string {
  const ext = extOf(filename);
  if (ext) return ext;
  const found = Object.entries(EXT_TO_MIME).find(([, m]) => m === (mimeType || "").toLowerCase());
  return found ? found[0] : "bin";
}

/**
 * Store a validated feedback file and extract its text. Returns the metadata to save
 * on the Feedback entry. The caller has already authorized the trainee + validated
 * size/type. Never stores the binary in the DB.
 */
export async function saveFeedbackAttachment(
  traineeId: string,
  file: { name: string; type: string; bytes: Buffer },
  uploadedBy: string,
): Promise<NewFeedbackAttachment> {
  const storageKey = `feedback/${traineeId}/${randomUUID()}.${safeExt(file.type, file.name)}`;
  const mimeType = file.type || EXT_TO_MIME[extOf(file.name)] || "application/octet-stream";
  await getStorage().put(storageKey, file.bytes, mimeType);
  const { text, status } = await extractText(file.bytes, mimeType, file.name);
  return {
    originalFileName: file.name || "קובץ",
    mimeType,
    size: file.bytes.length,
    storageKey,
    extractedText: text,
    extractionStatus: status,
    uploadedBy,
  };
}
