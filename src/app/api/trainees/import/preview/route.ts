import { NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/require-scope";
import { parseTraineeFile, isParsableFile } from "@/lib/import/parse-trainee-file";
import { guardContentLength, takeImportFile } from "@/lib/import/upload-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/trainees/import/preview — read a file and return the fields we could
 * extract from it.
 *
 * This endpoint CREATES NOTHING. It is the "read" half of the import: the user
 * always sees and confirms (and may edit) the extracted fields before any trainee
 * exists. The actual write happens in POST /api/trainees/import.
 *
 * The extracted text is deliberately NOT returned to the client — the client has
 * the file already, and echoing a whole document back would be pure waste. The
 * import route re-derives it from the same file.
 */
export async function POST(request: Request) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const tooBig = guardContentLength(request);
  if (tooBig) return tooBig;

  try {
    const form = await request.formData();
    const picked = takeImportFile(form);
    if (!picked.ok) return picked.response;

    const { file } = picked;
    const content = Buffer.from(await file.arrayBuffer());

    // Total by construction: an unreadable format yields empty fields + a warning
    // rather than an error, because the file is still worth attaching.
    const { fields, warnings } = parseTraineeFile(content, file.type, file.name);

    return NextResponse.json({
      fields,
      warnings,
      parsable: isParsableFile(file.type, file.name),
      file: { name: file.name, size: file.size, mimeType: file.type },
    });
  } catch (error) {
    console.error("[api/trainees/import/preview] failed:", error);
    return NextResponse.json({ error: "קריאת הקובץ נכשלה. נסו שוב." }, { status: 500 });
  }
}
