"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  /** Optional header title; also used as the dialog's accessible name. */
  title?: string;
  /**
   * Accessible name for a header-less dialog (no visible title bar). Ignored when
   * `title` is set. Use this for compact confirmation modals so the dialog is not
   * announced as an unnamed "dialog" (WCAG 4.1.2).
   */
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  /** Extra classes for the backdrop (e.g. a subtle `backdrop-blur-sm`). */
  backdropClassName?: string;
};

/**
 * Minimal accessible modal: Escape to close, backdrop click to dismiss, body
 * scroll lock while open, `role="dialog"` + `aria-modal`, initial focus on the
 * panel. Rendered only when `open` is true, via a React portal to `document.body`
 * so it can never be clipped or mis-positioned by an ancestor's overflow/transform
 * (§16) — the persistent shell uses `overflow-hidden`/`backdrop-blur` wrappers.
 */
export function Dialog({ open, onClose, title, ariaLabel, children, className, backdropClassName }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Portals need document.body — only available after mount (avoids SSR mismatch).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    // Restore focus to whatever was focused (the trigger) when the dialog closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Trap Tab within the panel so keyboard focus can't escape to the page behind.
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === panel)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className={cn("absolute inset-0 bg-slate-950/50", backdropClassName)} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? ariaLabel}
        className={cn(
          // Cap to the viewport and scroll internally so a tall form (e.g. signup)
          // is never clipped; short modals are unaffected.
          "relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface shadow-xl focus:outline-none",
          className,
        )}
      >
        {title ? (
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="סגירה"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
