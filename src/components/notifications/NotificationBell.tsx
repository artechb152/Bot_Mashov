"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { NotificationPopover } from "./NotificationPopover";

/**
 * Header notification bell with an unread badge. Clicking it toggles a rectangular
 * popover anchored to the bell (§8) — it never navigates away. The popover is
 * portaled to `document.body` and dynamically positioned, so it is never clipped and
 * works identically on the landing screen and inside the app shell. Outside-click,
 * Escape, and a second bell click all close it. The unread count polls every 60s
 * (no WebSockets/push) and re-syncs when the popover closes.
 */
export function NotificationBell() {
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

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `התראות (${unread} חדשות)` : "התראות"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="התראות"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -end-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <NotificationPopover anchorRef={buttonRef} panelRef={panelRef} onNavigate={() => setOpen(false)} />
      ) : null}
    </>
  );
}
