"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import { NotificationsList } from "./NotificationsList";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | null;
};

/**
 * A compact rectangular notification panel that opens next to the bell (§8): system
 * notifications only (not the full inbox). It is rendered through a React portal to
 * `document.body` and positioned with {@link useAnchoredPosition}, so it is measured
 * against the real bell position and the viewport — never clipped by a header/layout
 * overflow, and correct on the landing screen where the bell hugs the right edge.
 * Opening a notification (via `onNavigate`) closes it; the bell owns outside-click /
 * Escape closing (its handler treats `panelRef` as "inside").
 */
export function NotificationPopover({
  anchorRef,
  panelRef,
  onNavigate,
}: {
  /** The bell button — the panel is positioned relative to it. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Attached to the panel root so the bell's outside-click check can skip it. */
  panelRef: RefObject<HTMLDivElement | null>;
  onNavigate: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const style = useAnchoredPosition(anchorRef, true, { width: 320 });

  // Portals need document.body — only available after mount (avoids SSR mismatch).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        const d = (await r.json()) as { notifications: Notif[] };
        if (!cancelled) setItems(d.notifications ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("טעינת העדכונים נכשלה. נסו שוב.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      dir="rtl"
      role="dialog"
      aria-label="עדכונים"
      style={style}
      className="z-50 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-1.5 pe-1.5 ps-3">
        <h2 className="text-sm font-semibold text-ink">עדכונים</h2>
        <Link
          href="/notifications"
          onClick={onNavigate}
          className="inline-flex h-9 items-center rounded-lg px-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          לכל העדכונים
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? <p className="px-3 py-3 text-sm text-muted">טוען…</p> : null}
        {error ? <p role="alert" className="px-3 py-3 text-sm text-danger">{error}</p> : null}
        {items ? <NotificationsList initial={items} onNavigate={onNavigate} compact /> : null}
      </div>
    </div>,
    document.body,
  );
}
