import { NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/require-scope";
import { createTrainee, deleteTrainee, type TraineeInput } from "@/lib/data/trainees";
import { getCurrentAssignment } from "@/lib/data/assignments";
import { createAttachment } from "@/lib/data/attachments";
import { parseTraineeBody } from "@/lib/validation/trainee";
import { parseTraineeFile } from "@/lib/import/parse-trainee-file";
import { guardContentLength, takeImportFile } from "@/lib/import/upload-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/trainees/import — create a trainee from a reviewed file.
 *
 * Called only after the user has seen the extracted fields (from
 * /import/preview), edited them if needed, and confirmed. The FIELDS come from
 * the confirmed form, not from re-parsing — the user's edits are authoritative.
 * The FILE is re-sent so it can be stored as the trainee's source document.
 *
 * TWO WRITES, NO TRANSACTION. The local MongoDB is a standalone instance, so
 * multi-document transactions are not available. Instead the second write is
 * compensated: if attaching the source file fails, the just-created trainee is
 * deleted again, so the user can never end up with a file-imported trainee that
 * is missing the very file it came from. The rollback only ever deletes a
 * trainee this request created moments earlier, and only within the caller's own
 * scope — it can never touch pre-existing data.
 */
export async function POST(request: Request) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const tooBig = guardContentLength(request);
  if (tooBig) return tooBig;

  let traineeId: string | null = null;

  try {
    const form = await request.formData();

    const picked = takeImportFile(form);
    if (!picked.ok) return picked.response;
    const { file } = picked;

    // The reviewed fields, as JSON, from the confirmation form.
    const raw = form.get("fields");
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "חסרים פרטי החניך." }, { status: 400 });
    }
    let fieldsBody: unknown;
    try {
      fieldsBody = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "פרטי החניך אינם תקינים." }, { status: 400 });
    }

    // Same validation as a manual create — an import is not a way to bypass it.
    const parsed = parseTraineeBody(fieldsBody, false);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.errors.join(" "), errors: parsed.errors },
        { status: 400 },
      );
    }

    const content = Buffer.from(await file.arrayBuffer());
    // Re-derive the text server-side; never trust a client-supplied extraction.
    const { extractedText } = parseTraineeFile(content, file.type, file.name);

    // (1) Create the trainee — stamped with the session's ownerId + courseType,
    // plus the staff user's current cohort/team (server-derived).
    const assignment = await getCurrentAssignment(auth.scope.ownerId);
    const trainee = await createTrainee(parsed.data as TraineeInput, auth.scope, {
      cohortId: assignment?.cohortId ?? null,
      teamId: assignment?.teamId ?? null,
    });
    traineeId = trainee.id;

    // (2) Attach the source file it was imported from.
    const attachment = await createAttachment(trainee.id, auth.scope, {
      originalName: file.name || "קובץ",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      content,
      extractedText,
    });

    if (!attachment) {
      // Compensating rollback — see the note at the top of this file.
      await deleteTrainee(trainee.id, auth.scope);
      traineeId = null;
      console.error("[api/trainees/import] attachment failed → rolled back trainee");
      return NextResponse.json(
        { error: "צירוף הקובץ נכשל, ולכן החניך לא נוצר. נסו שוב." },
        { status: 500 },
      );
    }

    console.log(`[api/trainees/import] created ${trainee.id} from "${file.name}" → 201`);
    return NextResponse.json({ trainee, attachment }, { status: 201 });
  } catch (error) {
    // The trainee was created but something later threw — undo it, so a failed
    // import never leaves a half-made trainee behind.
    if (traineeId) {
      await deleteTrainee(traineeId, auth.scope).catch((rollbackError) => {
        console.error("[api/trainees/import] ROLLBACK FAILED for", traineeId, rollbackError);
      });
    }
    console.error("[api/trainees/import] failed:", error);
    return NextResponse.json({ error: "יצירת החניך מהקובץ נכשלה. נסו שוב." }, { status: 500 });
  }
}
