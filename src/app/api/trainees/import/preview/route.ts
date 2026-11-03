import { NextResponse } from "next/server";
import { requireScope } from "@/lib/auth/require-scope";
import { guardContentLength, takeImportFile } from "@/lib/import/upload-guard";
import { extractImportText } from "@/lib/files/trainee-import";
import { getAIStatus, runAITask } from "@/lib/ai";
import { buildExtractionContext } from "@/lib/ai/build-context";
import type { TraineeFileExtractOutput } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/trainees/import/preview — read a document and return the trainee fields
 * the AI could extract from it. **CREATES NOTHING.** The user always reviews (and may
 * edit/complete) the fields before any trainee exists; the write happens in
 * POST /api/trainees/import.
 *
 * Flow: extract text (server-side, pdf-parse/mammoth) → if text + AI configured, run a
 * structured extraction → return editable fields. Guardrails:
 *   - no readable text (scanned PDF, unsupported) → empty fields + "type it in by hand";
 *   - AI not configured / AI error → empty fields + a clear message (never a partial
 *     fabricated result presented as truth);
 *   - the BINARY is never sent to the AI — only the extracted text.
 *
 * RBAC: `requireScope` — the same session+course gate as a manual create. The AI is
 * NOT an authority on course/cohort/role; those are decided by the human on confirm
 * and validated server-side by the write route.
 */
const EMPTY_FIELDS = { fullName: "", team: "", strengths: [] as string[], weaknesses: [] as string[], notes: "" };

const MISSING_LABELS: Record<string, string> = {
  fullName: "שם",
  team: "צוות",
  strengths: "חוזקות",
  weaknesses: "חולשות",
  notes: "הערות",
};

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
    const fileMeta = { name: file.name, size: file.size, mimeType: file.type };

    // 1) Extract text (never throws — returns a status).
    const { text, status } = await extractImportText(content, file.type, file.name);
    if (status !== "extracted" || text.trim().length === 0) {
      const warning =
        status === "unsupported"
          ? "לא ניתן לקרוא טקסט מסוג קובץ זה אוטומטית. ניתן להזין את הפרטים ידנית — הקובץ יישמר כמקור."
          : "לא נמצא טקסט הניתן לקריאה בקובץ (ייתכן שהוא סרוק). ניתן להזין את הפרטים ידנית — הקובץ יישמר כמקור.";
      return NextResponse.json({
        fields: EMPTY_FIELDS,
        warnings: [warning],
        extractionStatus: status,
        aiUsed: false,
        suggestedCohortName: null,
        file: fileMeta,
      });
    }

    // 2) AI must be configured to extract structured fields.
    const ai = getAIStatus();
    if (!ai.configured) {
      return NextResponse.json({
        fields: EMPTY_FIELDS,
        warnings: ["הופק טקסט מהקובץ, אך שירות ה-AI אינו מחובר — הזינו את הפרטים ידנית."],
        extractionStatus: status,
        aiUsed: false,
        suggestedCohortName: null,
        file: fileMeta,
      });
    }

    // 3) Structured extraction (document TEXT only — never the binary).
    const context = await buildExtractionContext();
    const result = await runAITask("trainee_file_extract", { text: text.trim() }, context);

    if (result.status !== "ok") {
      return NextResponse.json({
        fields: EMPTY_FIELDS,
        warnings: [result.message, "ניתן להזין את הפרטים ידנית — הקובץ יישמר כמקור."],
        extractionStatus: status,
        aiUsed: false,
        suggestedCohortName: null,
        file: fileMeta,
      });
    }

    const out = result.output as TraineeFileExtractOutput;
    const warnings: string[] = [];
    const missing = (out.missingFields ?? []).map((k) => MISSING_LABELS[k] ?? k).filter(Boolean);
    if (missing.length > 0) warnings.push(`שדות שלא זוהו בבירור והושארו ריקים: ${missing.join(", ")}.`);
    warnings.push("אלו פרטים שחולצו אוטומטית — בדקו והשלימו לפני האישור.");

    return NextResponse.json({
      fields: {
        fullName: out.fullName ?? "",
        team: out.team ?? "",
        strengths: Array.isArray(out.strengths) ? out.strengths : [],
        weaknesses: Array.isArray(out.weaknesses) ? out.weaknesses : [],
        notes: out.notes ?? "",
      },
      warnings,
      extractionStatus: status,
      aiUsed: true,
      suggestedCohortName: out.suggestedCohortName ?? null,
      file: fileMeta,
    });
  } catch (error) {
    console.error("[api/trainees/import/preview] failed:", error);
    return NextResponse.json({ error: "קריאת הקובץ נכשלה. נסו שוב." }, { status: 500 });
  }
}
