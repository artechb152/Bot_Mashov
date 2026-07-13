"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";

export function DeleteTraineeButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    // Set once we start a full-page navigation, so `finally` keeps the button
    // disabled through the unload (no flash, no double submit).
    let navigating = false;
    try {
      const res = await fetch(`/api/trainees/${id}`, { method: "DELETE" });
      // DELETE is idempotent: a 404 means the trainee is already gone — that is
      // the desired end state, so treat it as success rather than an error.
      if (!res.ok && res.status !== 404) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "מחיקת החניך נכשלה.");
        return;
      }
      // Success: full-page navigation to the (fresh) list so the removal shows
      // immediately — no manual refresh. (A router.push + router.refresh combo
      // could race and leave the button stuck on "מוחק…".)
      navigating = true;
      window.location.assign("/trainees");
    } catch {
      setError("מחיקת החניך נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (!navigating) setDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="danger"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        מחיקה
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (deleting) return;
          setError(null);
          setOpen(false);
        }}
        title="מחיקת חניך"
      >
        <p className="text-sm text-muted">
          האם למחוק את <span className="font-medium text-ink">{name}</span>? הפעולה אינה הפיכה.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
            ביטול
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={deleting}>
            {deleting ? "מוחק…" : "מחיקה"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
