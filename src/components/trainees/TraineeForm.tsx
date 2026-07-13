"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { arrayToLines, linesToArray } from "@/lib/text";
import type { TraineeDTO } from "@/lib/data/trainees";

type TraineeFormProps = {
  mode: "create" | "edit";
  /** Required when mode is "edit". */
  initial?: TraineeDTO;
};

export function TraineeForm({ mode, initial }: TraineeFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [team, setTeam] = useState(initial?.team ?? "");
  const [strengthsText, setStrengthsText] = useState(arrayToLines(initial?.strengths));
  const [weaknessesText, setWeaknessesText] = useState(arrayToLines(initial?.weaknesses));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("שם מלא הוא שדה חובה.");
      return;
    }

    const payload = {
      fullName: fullName.trim(),
      team: team.trim(),
      strengths: linesToArray(strengthsText),
      weaknesses: linesToArray(weaknessesText),
      notes: notes.trim(),
    };

    setSubmitting(true);
    // Set once we start a full-page navigation, so `finally` keeps the button
    // disabled through the unload (no flash, no double submit).
    let navigating = false;
    try {
      const url = mode === "create" ? "/api/trainees" : `/api/trainees/${initial!.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        trainee?: TraineeDTO;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "שמירת החניך נכשלה.");
        return;
      }

      // Success: full-page navigation to the (fresh) profile so the saved data
      // shows immediately — no manual refresh. (A router.push + router.refresh
      // combo could race and leave the button stuck on "שומר…".)
      const id = data.trainee?.id ?? initial?.id;
      navigating = true;
      window.location.assign(id ? `/trainees/${id}` : "/trainees");
    } catch {
      setError("שמירת החניך נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (!navigating) setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-surface px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <Field label="שם מלא" htmlFor="fullName" required>
        <Input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="off"
          required
        />
      </Field>

      <Field label="צוות" htmlFor="team" hint="לא חובה">
        <Input id="team" value={team} onChange={(e) => setTeam(e.target.value)} autoComplete="off" />
      </Field>

      <Field label="חוזקות" htmlFor="strengths" hint="שורה לכל פריט">
        <Textarea
          id="strengths"
          value={strengthsText}
          onChange={(e) => setStrengthsText(e.target.value)}
          rows={4}
          placeholder={"חוזקה בכל שורה"}
        />
      </Field>

      <Field label="חולשות" htmlFor="weaknesses" hint="שורה לכל פריט">
        <Textarea
          id="weaknesses"
          value={weaknessesText}
          onChange={(e) => setWeaknessesText(e.target.value)}
          rows={4}
          placeholder={"חולשה בכל שורה"}
        />
      </Field>

      <Field label="הערות מפקד" htmlFor="notes" hint="לא חובה">
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </Field>

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={submitting}>
          {submitting ? "שומר…" : mode === "create" ? "הוספת חניך" : "שמירת שינויים"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={submitting}
        >
          ביטול
        </Button>
      </div>
    </form>
  );
}
