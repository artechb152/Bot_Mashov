/**
 * Server-side text extraction from feedback files. **Server-only.**
 *
 * TXT is read natively; PDF (pdf-parse) and DOCX (mammoth) are parsed via their libs,
 * loaded lazily so a missing/broken dep degrades gracefully instead of crashing the
 * upload. No OCR: a scanned/image-only PDF with no text layer yields status "empty"
 * (never a heavy OCR fallback). Total + never throws.
 *
 * The extracted text (not the binary) is what later reaches the AI context.
 */

export type ExtractionStatus = "extracted" | "empty" | "unsupported" | "failed";

export type ExtractionResult = { text: string; status: ExtractionStatus };

const MIME = {
  txt: new Set(["text/plain", "text/markdown", "text/csv"]),
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

function extOf(name: string): string {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function finish(text: string): ExtractionResult {
  const trimmed = text.trim();
  return trimmed ? { text: trimmed, status: "extracted" } : { text: "", status: "empty" };
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const mod = (await import("pdf-parse")) as unknown as Record<string, unknown>;
    const fn = (mod.default ?? mod.pdf ?? mod) as (b: Buffer) => Promise<{ text?: string }>;
    const res = await fn(buffer);
    return finish(res?.text ?? "");
  } catch {
    return { text: "", status: "failed" };
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const mod = (await import("mammoth")) as unknown as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value?: string }>;
    };
    const res = await mod.extractRawText({ buffer });
    return finish(res?.value ?? "");
  } catch {
    return { text: "", status: "failed" };
  }
}

/** Extract plain text from a supported document. Never throws. */
export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractionResult> {
  const mime = (mimeType || "").toLowerCase();
  const ext = extOf(filename);

  if (MIME.txt.has(mime) || ext === "txt" || ext === "md" || ext === "csv") {
    try {
      return finish(buffer.toString("utf8").replace(/^﻿/, ""));
    } catch {
      return { text: "", status: "failed" };
    }
  }
  if (mime === MIME.pdf || ext === "pdf") return extractPdf(buffer);
  if (mime === MIME.docx || ext === "docx") return extractDocx(buffer);
  return { text: "", status: "unsupported" };
}
