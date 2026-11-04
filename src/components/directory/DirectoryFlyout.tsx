"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { useModalFocus } from "@/lib/hooks/useModalFocus";
import { DirectoryView } from "./DirectoryView";
import type { Directory, DirectoryCard } from "@/lib/data/directory";

function matches(u: DirectoryCard, q: string): boolean {
  return `${u.displayName} ${u.username}`.toLowerCase().includes(q);
}

/** Client-side search over the already-scoped directory (no extra server round-trips). */
function filterDirectory(dir: Directory, query: string): Directory {
  const q = query.trim().toLowerCase();
  if (!q) return dir;
  return {
    roots: dir.roots.filter((u) => matches(u, q)),
    superAdmins: dir.superAdmins.filter((u) => matches(u, q)),
    courses: dir.courses
      .map((c) => ({ ...c, admins: c.admins.filter((u) => matches(u, q)), staff: c.staff.filter((u) => matches(u, q)) }))
      .filter((c) => c.admins.length > 0 || c.staff.length > 0),
  };
}

/**
 * The people directory (§18) as a flyout from the sidebar's "אנשי המערכת" item —
 * it never navigates to a standalone page. It opens OVER the right-hand rail from the
 * inline-start (right) edge (`start-0`), fully covering the sidebar (its opaque panel
 * makes the rail beneath non-clickable) and expanding a little past it for the tile
 * grid; the main content column never shifts. Portaled to body so it is never clipped.
 * A transparent catcher closes it on outside-click without darkening the whole app —
 * only a soft shadow sets the panel apart. Escape closes it too, but defers while the
 * profile modal (inside DirectoryView) is open above it, so that closes first.
 */
export function DirectoryFlyout({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [dir, setDir] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // The profile modal owns Escape while it is open (kept in a ref so the key handler
  // stays subscribed once and always reads the latest value).
  const profileOpenRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Modal behaviour: focus the search on open, trap Tab, Escape closes (after the
  // profile modal, which owns Escape while open), focus returns to the trigger.
  useModalFocus(panelRef, open && mounted, onClose, {
    initialFocus: searchRef,
    escapeEnabled: () => !profileOpenRef.current,
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || dir) return; // fetch once, lazily
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/directory")
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        const data = (await r.json()) as { directory: Directory };
        if (!cancelled) setDir(data.directory);
      })
      .catch(() => {
        if (!cancelled) setError("טעינת אנשי המערכת נכשלה. נסו שוב.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dir]);

  if (!open || !mounted) return null;

  const filtered = dir ? filterDirectory(dir, query) : null;

  return createPortal(
    <div dir="rtl" className="fixed inset-0 z-40">
      {/* Transparent catcher — closes on outside-click, no heavy page darkening. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="אנשי המערכת"
        className="absolute inset-y-0 start-0 flex w-full max-w-sm flex-col border-e border-line bg-canvas shadow-2xl focus:outline-none lg:w-96"
      >
        <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h2 className="text-base font-semibold text-ink">אנשי המערכת</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-line bg-surface p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש משתמש…"
              aria-label="חיפוש משתמש"
              className="h-11 w-full rounded-lg border border-control bg-surface py-2 pe-3 ps-9 text-base sm:h-10 sm:text-sm text-ink placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25 focus-visible:border-focus"
            />
          </div>
        </div>

        {/* Scroll container forced to LTR so its vertical scrollbar sits on the RIGHT
            in this RTL panel (§10); the inner content is restored to RTL so nothing
            is visually reversed. Single scroll container — no nested/double scroll. */}
        <div dir="ltr" className="min-h-0 flex-1 overflow-y-auto p-4">
          <div dir="rtl">
            {loading ? <p className="text-sm text-muted">טוען…</p> : null}
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            {filtered ? (
              <DirectoryView
                directory={filtered}
                onBeforeNavigate={onClose}
                onProfileOpenChange={(o) => {
                  profileOpenRef.current = o;
                }}
              />
            ) : null}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
