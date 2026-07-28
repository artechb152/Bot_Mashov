"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog } from "@/components/ui";

/**
 * The user card: avatar + username + a logout button. It no longer holds the
 * notification bell or the settings gear — those are separate shared controls in
 * the top bar (the bell to its inline-start, the gear pinned to the inline-end).
 * The logout button opens a small centered confirmation modal.
 */
export function UserMenu({ username, className }: { username: string; className?: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function closeConfirm() {
    setConfirmOpen(false);
    setError(null);
  }

  async function logout() {
    setLoggingOut(true);
    let navigating = false;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      navigating = true;
      window.location.assign("/login");
    } catch {
      setError("ההתנתקות נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (!navigating) setLoggingOut(false);
    }
  }

  const initial = username.charAt(0).toUpperCase();

  return (
    <>
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pe-1 ps-2 text-sm text-ink",
          className,
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{username}</span>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          aria-label="התנתקות"
          title="התנתקות"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        >
          {/* Flip horizontally for RTL so the arrow points inline-end (left). */}
          <LogOut className="h-4 w-4 -scale-x-100" aria-hidden="true" />
        </button>
      </div>

      <Dialog open={confirmOpen} onClose={closeConfirm} ariaLabel="התנתקות" className="max-w-sm">
        <p className="text-sm text-ink">האם אתה בטוח שאתה רוצה להתנתק?</p>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={closeConfirm} disabled={loggingOut}>
            ביטול
          </Button>
          <Button onClick={logout} disabled={loggingOut}>
            {loggingOut ? "מתנתק…" : "התנתקות"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
