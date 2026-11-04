"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { NotificationPopover } from "./NotificationPopover";

/**
 * Header notification bell with an unread badge. Clicking it toggles a rectangular
 * popover anchored to the bell (§8) — it never navigates away. The popover is
 * portaled to `document.body` and dynamically positioned, so it is never clipped and
 * works identically on the landing screen and inside the app shell. Outside-click,
 * Escape, and a second bell click all close it. The unread count polls every 60s
 * (no WebSockets/push) and re-syncs when the popover closes.
 */
/** Shared row style for first-level items in the dark navigation rail. */
export const RAIL_ITEM =
  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-start text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rail-ink";

/**
 * `variant="rail"` renders a full-width "עדכונים" row for the sidebar; the default is
 * the compact icon button used in the phone top bar.
 */
export function NotificationBell({ variant = "icon" }: { variant?: "icon" | "rail" }) {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?count=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread?: number };
      setUnread(typeof data.unread === "number" ? data.unread : 0);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 60_000);
    return () => clearInterval(t);
  }, [refreshCount]);

  const close = useCallback(() => {
    setOpen(false);
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      // The panel is portaled outside this component, so check it explicitly.
      if (buttonRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const label = unread > 0 ? `עדכונים (${unread} חדשים)` : "עדכונים";
  const count = unread > 99 ? "99+" : String(unread);

  return (
    <>
      {variant === "rail" ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(RAIL_ITEM, open ? "bg-rail-active text-rail-ink" : "text-rail-ink/90 hover:bg-rail-hover hover:text-rail-ink")}
        >
          <Bell className="h-5 w-5 shrink-0 text-rail-muted" aria-hidden="true" />
          <span className="flex-1">עדכונים</span>
          {unread > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rail-ink px-1.5 text-xs font-semibold tabular-nums text-rail" aria-hidden="true">
              {count}
            </span>
          ) : null}
        </button>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          title="עדכונים"
          className="relative grid h-10 w-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute end-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6875rem] font-semibold leading-none tabular-nums text-white" aria-hidden="true">
              {count}
            </span>
          ) : null}
        </button>
      )}
      {open ? (
        <NotificationPopover anchorRef={buttonRef} panelRef={panelRef} onNavigate={() => setOpen(false)} />
      ) : null}
    </>
  );
}
