"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { CourseChoice } from "@/components/course/CourseChoice";
import type { CourseType } from "@/lib/domain/types";

/**
 * One-time course choice for a user whose record predates course modes.
 *
 * Submitting also backfills that user's existing trainees server-side (see
 * `POST /api/auth/course`), so nothing they already own is lost or hidden.
 */
export function SelectCourseForm() {
  const [courseType, setCourseType] = useState<CourseType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!courseType) {
      setError("יש לבחור קורס.");
      return;
    }

    setSubmitting(true);
    // Set once a full-page navigation starts, so `finally` keeps the button
    // disabled through the unload (no flash, no double submit).
    let navigating = false;
    try {
      const res = await fetch("/api/auth/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseType }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "שמירת הקורס נכשלה.");
        return;
      }

      // Success: full-page navigation so the re-signed session cookie is applied
      // and the app renders with the course immediately — no manual refresh.
      navigating = true;
      window.location.assign("/");
    } catch {
      setError("שמירת הקורס נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (!navigating) setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-surface px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <CourseChoice value={courseType} onChange={setCourseType} disabled={submitting} />

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "שומר…" : "המשך"}
      </Button>
    </form>
  );
}
