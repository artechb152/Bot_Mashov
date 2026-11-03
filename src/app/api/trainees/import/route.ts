import { NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/require-scope";
import { createTrainee, type TraineeInput } from "@/lib/data/trainees";
import { getCurrentAssignment } from "@/lib/data/assignments";
import { isCohortInCourse } from "@/lib/data/cohorts";
import { parseTraineeBody } from "@/lib/validation/trainee";
import { guardContentLength, takeImportFile } from "@/lib/import/upload-guard";
import { storeImportFile, deleteImportFile } from "@/lib/files/trainee-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/trainees/import — create a trainee from a reviewed document.
 *
 * Called only after the user reviewed the extracted fields (from /import/preview),
 * edited/completed them, and confirmed. The FIELDS come from the confirmed form — at
 * that point they are exactly a manual entry, and are re-validated by the SAME
 * `parseTraineeBody` a manual create uses (an import is never a way to bypass it).
 *
 * Authority boundaries (the AI is NOT trusted for these):
 *   - ownerId + courseType are stamped from the session, never the body/AI;
 *   - a client-chosen cohort must belong to the caller's course (server-validated),
 *     else it is rejected — exactly like the manual create route;
 *   - the source file is stored in FileStorage (a `storageKey`, never binary in Mongo,
 *     never a path exposed to the client) and referenced on the trainee for traceability.
 *
 * The source file is stored BEFORE the trainee is created; if trainee creation fails,
 * the stored blob is cleaned up so nothing is orphaned.
 */
export async function POST(request: Request) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const tooBig = guardContentLength(request);
  if (tooBig) return tooBig;

  let storedKey: string | null = null;

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

    // Same validation as a manual create.
    const parsed = parseTraineeBody(fieldsBody, false);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.errors.join(" "), errors: parsed.errors }, { status: 400 });
    }

    // A client-chosen cohort must belong to the caller's course (else fall back to the
    // staff user's current assignment). The AI never decides placement.
    const rawCohort = form.get("cohortId");
    let cohortId: string | null | undefined;
    if (typeof rawCohort === "string" && rawCohort.trim()) {
      const okCohort = await isCohortInCourse(rawCohort, auth.scope.courseType);
      if (!okCohort) {
        return NextResponse.json({ error: "המחזור שנבחר אינו תקין." }, { status: 400 });
      }
      cohortId = rawCohort;
    } else if (typeof rawCohort === "string") {
      cohortId = null; // explicit "no cohort"
    }

    const assignment = await getCurrentAssignment(auth.scope.ownerId);
    const teamId = assignment?.teamId ?? null;
    const resolvedCohortId = cohortId !== undefined ? cohortId : assignment?.cohortId ?? null;

    // (1) Store the source file first (FileStorage — never Mongo).
    const content = Buffer.from(await file.arrayBuffer());
    const stored = await storeImportFile({ name: file.name, type: file.type, bytes: content });
    storedKey = stored.storageKey;

    // (2) Create the trainee, referencing the stored file for traceability.
    const trainee = await createTrainee(
      parsed.data as TraineeInput,
      auth.scope,
      { cohortId: resolvedCohortId, teamId },
      {
        originalFileName: stored.originalFileName,
        mimeType: stored.mimeType,
        size: stored.size,
        storageKey: stored.storageKey,
        extractionStatus: stored.extractionStatus,
        uploadedBy: auth.scope.ownerId,
        uploadedAt: new Date(),
      },
    );

    console.log(`[api/trainees/import] created ${trainee.id} from "${file.name}" → 201`);
    return NextResponse.json({ trainee }, { status: 201 });
  } catch (error) {
    // Clean up the stored blob so a failed import never orphans a file.
    if (storedKey) await deleteImportFile(storedKey);
    console.error("[api/trainees/import] failed:", error);
    return NextResponse.json({ error: "יצירת החניך מהקובץ נכשלה. נסו שוב." }, { status: 500 });
  }
}
