"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronUp, LogOut, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog } from "@/components/ui";

/**
 * The account menu — a compact dropdown opened from the user card (kept in the sidebar
 * footer so it is present everywhere, including /workspace). It is the SINGLE entry
 * point for personal + account actions: my profile, updates, settings, management (for
 * managers only), and logout. RTL: the menu aligns to the inline-start edge and opens
 * upward (the trigger sits at the bottom of the rail).
 */
export function UserMenu({
  username,
  manager = false,
  managementHref = "/admin/users",
  className,
}: {
  username: string;
  /** Whether to show the "ניהול המערכת" item (admin/super only — server-decided). */
  manager?: boolean;
  managementHref?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    let navigating = false;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      navigating = true;
      window.location.assign("/");
    } catch {
      setError("ההתנתקות נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (!navigating) setLoggingOut(false);
    }
  }

  const initial = username.charAt(0).toUpperCase();
  const itemClass =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:bg-surface-2";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pe-2 ps-2 text-sm text-ink transition-colors hover:bg-surface-2",
          className,
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white" aria-hidden="true">
          {initial}
        </span>
        <span className="hidden min-w-0 flex-1 truncate text-start sm:block">{username}</span>
        <ChevronUp className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", !open && "rotate-180")} aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="תפריט המשתמש"
          className="absolute bottom-full end-0 z-30 mb-2 w-52 rounded-xl border border-line bg-surface p-1 text-ink shadow-lg"
        >
          <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <User className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            פרופיל
          </Link>
          <Link href="/notifications" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <Bell className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            עדכונים
          </Link>
          {manager ? (
            <Link href={managementHref} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
              <ShieldCheck className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              ניהול המערכת
            </Link>
          ) : null}
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmOpen(true);
            }}
            className={cn(itemClass, "text-danger")}
          >
            <LogOut className="h-4 w-4 shrink-0 -scale-x-100" aria-hidden="true" />
            התנתקות
          </button>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setError(null); }} ariaLabel="התנתקות" className="max-w-sm">
        <p className="text-sm text-ink">האם אתה בטוח שאתה רוצה להתנתק?</p>
        {error ? (
          <p role="alert" className="mt-3 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={loggingOut}>
            ביטול
          </Button>
          <Button onClick={logout} disabled={loggingOut}>
            {loggingOut ? "מתנתק…" : "התנתקות"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
