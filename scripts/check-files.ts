/**
 * Checks for feedback files: text extraction, the allow-list, and the storage
 * abstraction (metadata-only in DB; bytes behind FileStorage). No network. Run via tsx.
 *
 * Covers:
 *   - extractText: TXT → extracted; empty → empty; unsupported type → unsupported.
 *   - isAllowedFeedbackFile: PDF/DOCX/TXT allowed; others rejected (by mime OR ext).
 *   - FileStorage: put→get→delete round-trips; path-traversal keys are rejected;
 *     the binary lives on disk (never returned as part of any metadata).
 *
 * Run:  npx tsx scripts/check-files.ts   (or: npm run check:files)
 */
import path from "node:path";
import os from "node:os";

// Isolate storage to a throwaway dir BEFORE importing the storage module.
process.env.FILE_STORAGE_DIR = path.join(os.tmpdir(), `chp-storage-check-${process.pid}`);

import { extractText } from "@/lib/files/extract-text";
import { isAllowedFeedbackFile, MAX_FEEDBACK_FILE_BYTES } from "@/lib/files/feedback-attachments";
import { getStorage } from "@/lib/storage";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`);
  }
}
const ok = (name: string, cond: boolean) => check(name, cond, true);

async function main(): Promise<void> {
  console.log("\nextractText\n");
  const txt = await extractText(Buffer.from("שלום עולם", "utf8"), "text/plain", "note.txt");
  check("TXT → extracted", txt.status, "extracted");
  ok("TXT text preserved", txt.text.includes("שלום עולם"));
  check("empty TXT → empty", (await extractText(Buffer.from("   "), "text/plain", "e.txt")).status, "empty");
  check("unknown type → unsupported", (await extractText(Buffer.from([1, 2, 3]), "image/png", "x.png")).status, "unsupported");

  console.log("\nisAllowedFeedbackFile\n");
  ok("pdf allowed", isAllowedFeedbackFile("application/pdf", "a.pdf"));
  ok("docx allowed", isAllowedFeedbackFile("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "a.docx"));
  ok("txt allowed", isAllowedFeedbackFile("text/plain", "a.txt"));
  ok("allowed by extension when mime blank", isAllowedFeedbackFile("", "a.pdf"));
  ok("png rejected", !isAllowedFeedbackFile("image/png", "a.png"));
  ok("exe rejected", !isAllowedFeedbackFile("application/octet-stream", "a.exe"));

  console.log("\nFileStorage\n");
  ok("max size is sane (10MB)", MAX_FEEDBACK_FILE_BYTES === 10 * 1024 * 1024);
  const storage = getStorage();
  const key = "feedback/trainee1/doc-1.txt";
  await storage.put(key, Buffer.from("hello"), "text/plain");
  const got = await storage.get(key);
  ok("put→get round-trips the bytes", got !== null && got.toString("utf8") === "hello");
  await storage.delete(key);
  ok("delete removes the object", (await storage.get(key)) === null);
  ok("missing key → null (no throw)", (await storage.get("feedback/none/none.txt")) === null);

  let rejected = false;
  try {
    await storage.put("../escape.txt", Buffer.from("x"), "text/plain");
  } catch {
    rejected = true;
  }
  ok("path-traversal key rejected", rejected);

  console.log(failures === 0 ? "\n✓ all file checks passed" : `\n✗ ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("check-files failed to run:", err);
  process.exit(1);
});
