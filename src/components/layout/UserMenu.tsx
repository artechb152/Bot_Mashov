"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog } from "@/components/ui";

/**
 * Compact user box: avatar + username + a logout icon button. No dropdown — the
 * logout button opens a small centered confirmation modal. Used consistently
 * everywhere the user control appears (topbar, chat work bar, landing).
 */
export function UserMenu({ username, className }: { username: string; className?: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // best-effort — navigate to login regardless
    }
    // Full-page navigation so the cleared cookie takes effect immediately and we
    // never get stuck on "מתנתק…". (router.push + router.refresh could race and
    // leave the modal button spinning.) Button stays disabled through the unload.
    window.location.assign("/login");
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
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        ariaLabel="התנתקות"
        className="max-w-sm"
      >
        <p className="text-sm text-ink">האם אתה בטוח שאתה רוצה להתנתק?</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loggingOut}>
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
