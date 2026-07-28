"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Compact "סינון" filter control (§39): a low-emphasis trigger showing an active-
 * filter count, opening a small popover with the filter controls (children) and a
 * clear action. Closes on Escape / outside click. The consumer keeps the filter
 * state (ideally mirrored to URL params) — this is only the presentation.
 */
export function FilterPopover({
  activeCount,
  onClear,
  children,
  align = "start",
}: {
  activeCount: number;
  onClear: () => void;
  children: React.ReactNode;
  /** Which edge the panel aligns to (RTL logical): "start" (right) or "end" (left). */
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
          activeCount > 0 && "border-slate-900",
        )}
      >
        <SlidersHorizontal className="h-4 w-4 text-subtle" aria-hidden="true" />
        סינון
        {activeCount > 0 ? (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1 text-xs font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="סינון"
          className={cn(
            "absolute z-20 mt-2 w-64 rounded-lg border border-line bg-surface p-3 shadow-lg",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          <div className="space-y-3">{children}</div>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="mt-3 text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              ניקוי סינון ({activeCount})
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
