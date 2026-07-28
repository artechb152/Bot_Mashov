"use client";

import { useRef, useState } from "react";
import { FileText, Upload } from "lucide-react";
import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { arrayToLines, linesToArray } from "@/lib/text";
import type { TraineeDTO } from "@/lib/data/trainees";

type PreviewResponse = {
  fields?: {
    fullName?: string;
    team?: string;
    strengths?: string[];
    weaknesses?: string[];
    notes?: string;
  };
  warnings?: string[];
  file?: { name: string; size: number };
  error?: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * "הוספת חניך מקובץ" — a two-step import.
 *
 *   1. pick a file → it is read on the server, which extracts what it can
 *      (nothing is created yet);
 *   2. the extracted fields open in an EDITABLE review form. Only when the user
 *      confirms is the trainee created, with the original file attached to it.
 *
 * Formats we cannot read (PDF, DOCX…) still reach step 2 — with empty fields and
 * a clear warning — so the file is attached and the details are typed in by hand.
 */
export function ImportTraineeDialog() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Reviewed (editable) fields.
  const [fullName, setFullName] = useState("");
  const [team, setTeam] = useState("");
  const [strengthsText, setStrengthsText] = useState("");
  const [weaknessesText, setWeaknessesText] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setFile(null);
    setWarnings([]);
    setError(null);
    setFullName("");
    setTeam("");
    setStrengthsText("");
    setWeaknessesText("");
    setNotes("");
  }

  function closeDialog() {
    if (submitting) return;
    setOpen(false);
    reset();
  }

  /** Step 1 — upload for extraction. Creates nothing. */
  async function handleFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    event.target.value = ""; // let the same file be picked again later
    if (!picked) return;

    reset();
    setFile(picked);
    setReading(true);
    try {
      const fd = new FormData();
      fd.append("file", picked);
      const res = await fetch("/api/trainees/import/preview", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as PreviewResponse;

      if (!res.ok) {
        setError(data.error ?? "קריאת הקובץ נכשלה.");
        setFile(null);
        return;
      }

      const f = data.fields ?? {};
      setFullName(f.fullName ?? "");
      setTeam(f.team ?? "");
      setStrengthsText(arrayToLines(f.strengths));
      setWeaknessesText(arrayToLines(f.weaknesses));
      setNotes(f.notes ?? "");
      setWarnings(data.warnings ?? []);
      setOpen(true);
    } catch {
      setError("קריאת הקובץ נכשלה. בדקו את החיבור ונסו שוב.");
      setFile(null);
    } finally {
      setReading(false);
    }
  }

  /** Step 2 — confirm. Creates the trainee AND attaches the source file. */
  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("שם מלא הוא שדה חובה.");
      return;
    }
    if (!file) {
      setError("לא נבחר קובץ.");
      return;
    }

    setSubmitting(true);
    // Set once a full-page navigation starts, so `finally` keeps the button
    // disabled through the unload (no flash, no double submit).
    let navigating = false;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "fields",
        JSON.stringify({
          fullName: fullName.trim(),
          team: team.trim(),
          strengths: linesToArray(strengthsText),
          weaknesses: linesToArray(weaknessesText),
          notes: notes.trim(),
        }),
      );

      const res = await fetch("/api/trainees/import", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        trainee?: TraineeDTO;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "יצירת החניך מהקובץ נכשלה.");
        return;
      }

      // Success: full-page navigation to the new profile so it shows immediately
      // — no manual refresh.
      navigating = true;
      window.location.assign(data.trainee ? `/trainees/${data.trainee.id}` : "/trainees");
    } catch {
      setError("יצירת החניך מהקובץ נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (!navigating) setSubmitting(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFilePicked}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={reading}
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        {reading ? "קורא קובץ…" : "הוספת חניך מקובץ"}
      </Button>

      {/* A preview error has no dialog to live in — surface it beside the button. */}
      {error && !open ? (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <Dialog open={open} onClose={closeDialog} title="בדיקת פרטי החניך" className="max-w-2xl">
        <form onSubmit={handleConfirm} className="space-y-5" noValidate>
          <p className="text-sm text-muted">
            אלו הפרטים שזוהו בקובץ. אפשר לערוך אותם — החניך ייווצר רק לאחר אישור.
          </p>

          {warnings.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-danger-line bg-danger-surface px-4 py-3 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <Field label="שם החניך" htmlFor="import-fullName" required>
            <Input
              id="import-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="off"
              required
            />
          </Field>

          <Field label="צוות" htmlFor="import-team" hint="לא חובה">
            <Input
              id="import-team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              autoComplete="off"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="חוזקות" htmlFor="import-strengths" hint="שורה לכל פריט">
              <Textarea
                id="import-strengths"
                value={strengthsText}
                onChange={(e) => setStrengthsText(e.target.value)}
                rows={4}
                placeholder="חוזקה בכל שורה"
              />
            </Field>
            <Field label="חולשות" htmlFor="import-weaknesses" hint="שורה לכל פריט">
              <Textarea
                id="import-weaknesses"
                value={weaknessesText}
                onChange={(e) => setWeaknessesText(e.target.value)}
                rows={4}
                placeholder="חולשה בכל שורה"
              />
            </Field>
          </div>

          <Field label="הערות מפקד" htmlFor="import-notes" hint="לא חובה">
            <Textarea
              id="import-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </Field>

          {/* The source file — attached to the trainee on confirm. */}
          {file ? (
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
              <FileText className="h-5 w-5 shrink-0 text-subtle" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{file.name}</p>
                <p className="text-xs text-muted">
                  {formatSize(file.size)} · הקובץ יצורף לתיק החניך
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={closeDialog} disabled={submitting}>
              ביטול
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "יוצר…" : "יצירת חניך"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
