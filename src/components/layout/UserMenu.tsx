"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronUp, LogOut, UserCog } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog } from "@/components/ui";

/**
 * The account menu — personal actions only: profile & security settings, and logout.
 * Work, people, updates and management are first-level items in the sidebar, so this
 * menu never duplicates navigation. It sits in the sidebar footer and opens upward;
 * `tone="rail"` styles the trigger for the dark navigation rail.
 */
export function UserMenu({
  username,
  subtitle,
  tone = "light",
  className,
}: {
  username: string;
  /** Second line under the name (e.g. role · course). */
  subtitle?: string;
  tone?: "light" | "rail";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape (focus returns to the trigger); arrow keys move.
  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    requestAnimationFrame(() => items()[0]?.focus());
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? (i + 1) % list.length : (i - 1 + list.length) % list.length;
        list[next]?.focus();
      }
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
    "flex h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";
  const rail = tone === "rail";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`תפריט החשבון של ${username}`}
        className={cn(
          "flex min-h-12 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
          rail
            ? "text-rail-ink hover:bg-rail-hover focus-visible:ring-rail-ink"
            : "border border-line bg-surface text-ink hover:bg-surface-2 focus-visible:ring-focus",
          className,
        )}
      >
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
            rail ? "bg-rail-ink text-rail" : "bg-brand-primary text-white",
          )}
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium" dir="auto">{username}</span>
          {subtitle ? <span className={cn("block truncate text-xs", rail ? "text-rail-muted" : "text-subtle")}>{subtitle}</span> : null}
        </span>
        <ChevronUp
          className={cn("h-4 w-4 shrink-0 transition-transform", rail ? "text-rail-muted" : "text-subtle", !open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="תפריט החשבון"
          className="absolute bottom-full start-0 z-30 mb-2 w-full min-w-52 rounded-xl border border-line bg-surface p-1 text-ink shadow-lg"
        >
          <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <UserCog className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            פרופיל והגדרות
          </Link>
          <div className="my-1 border-t border-line" role="separator" />
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

      <Dialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setError(null); }} title="התנתקות" className="max-w-sm">
        <p className="text-base text-ink">להתנתק מהמערכת?</p>
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
