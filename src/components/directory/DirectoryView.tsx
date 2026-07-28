"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Crown, Mail } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClasses, Dialog } from "@/components/ui";
import { useAnchoredPosition } from "@/lib/hooks/useAnchoredPosition";
import { ADMIN_POSITION_LABELS, COURSE_LABELS, USER_ROLE_LABELS, type UserRole } from "@/lib/domain/types";
import type { Directory, DirectoryCard } from "@/lib/data/directory";

function displayNameOf(u: DirectoryCard): string {
  return u.displayName || u.username;
}

function subtitleFor(u: DirectoryCard): string {
  return u.role === "admin" && u.adminPosition
    ? ADMIN_POSITION_LABELS[u.adminPosition]
    : USER_ROLE_LABELS[u.role];
}

/** A quiet, monochrome seniority hint (root shows the crown instead). */
function roleDotClass(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "bg-slate-700";
    case "admin":
      return "bg-slate-500";
    default:
      return "bg-slate-300";
  }
}

type PreviewHandlers = {
  onOpen: (u: DirectoryCard) => void;
  onPreview: (u: DirectoryCard, anchor: HTMLElement) => void;
  onPreviewEnd: () => void;
};

/**
 * A compact, square user tile: an avatar with the initial, a subtle role/hierarchy
 * marker, and an accessible name (aria-label + tooltip). Hover/Focus lifts the tile
 * and surfaces the {@link Preview} card; click / Enter / Space opens the full profile
 * modal (unchanged behavior). The lift is a `transform` (no layout reflow → the grid
 * never jumps), and it is disabled under `prefers-reduced-motion`.
 */
function Tile({ u, onOpen, onPreview, onPreviewEnd }: { u: DirectoryCard } & PreviewHandlers) {
  const name = displayNameOf(u);
  return (
    <button
      type="button"
      onClick={() => onOpen(u)}
      onMouseEnter={(e) => onPreview(u, e.currentTarget)}
      onMouseLeave={onPreviewEnd}
      onFocus={(e) => onPreview(u, e.currentTarget)}
      onBlur={onPreviewEnd}
      aria-label={`${name}, ${subtitleFor(u)}`}
      title={name}
      className={cn(
        "group relative flex aspect-square w-full items-center justify-center rounded-xl border border-line bg-surface",
        "transition duration-200 ease-out",
        "hover:z-10 hover:-translate-y-0.5 hover:scale-[1.06] hover:border-slate-300 hover:bg-surface-2 hover:shadow-md",
        "focus-visible:z-10 focus-visible:scale-[1.06] focus-visible:border-slate-400 focus-visible:bg-surface-2 focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100",
      )}
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
        {name.charAt(0).toUpperCase()}
      </span>
      {u.isRootSuperAdmin ? (
        <Crown className="absolute end-1 top-1 h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
      ) : (
        <span className={cn("absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full", roleDotClass(u.role))} aria-hidden="true" />
      )}
    </button>
  );
}

function TileGroup({ title, cards, handlers }: { title: string; cards: DirectoryCard[]; handlers: PreviewHandlers }) {
  if (cards.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {cards.map((u) => (
          <Tile key={u.id} u={u} {...handlers} />
        ))}
      </div>
    </section>
  );
}

/**
 * The hover/focus preview card. Rendered through a portal to `document.body` and
 * positioned by {@link useAnchoredPosition} against the hovered tile, so it is never
 * clipped by the group/list overflow and always flips + clamps to stay on-screen. It
 * is `pointer-events-none` so it can appear under the cursor without stealing the
 * tile's hover. Purely visual (the tile's aria-label carries the same info for SR).
 */
function Preview({ u, anchorRef }: { u: DirectoryCard; anchorRef: RefObject<HTMLElement | null> }) {
  const [mounted, setMounted] = useState(false);
  const style = useAnchoredPosition(anchorRef, true, { width: 240, gap: 8, margin: 12, maxHeight: 360 });
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const name = displayNameOf(u);
  return createPortal(
    <div
      dir="rtl"
      aria-hidden="true"
      style={style}
      className="pointer-events-none z-[45] rounded-xl border border-line bg-surface p-3 shadow-lg"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-900 text-base font-semibold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="truncate">{name}</span>
            {u.isRootSuperAdmin ? <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" /> : null}
          </p>
          <p className="truncate text-xs text-muted">{u.username}</p>
        </div>
      </div>
      <dl className="mt-2.5 space-y-1 border-t border-line pt-2.5 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">תפקיד</dt>
          <dd className="text-ink">{subtitleFor(u)}</dd>
        </div>
        {u.courseType ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">קורס</dt>
            <dd className="text-ink">{COURSE_LABELS[u.courseType]}</dd>
          </div>
        ) : null}
      </dl>
    </div>,
    document.body,
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export function DirectoryView({
  directory,
  onBeforeNavigate,
  onProfileOpenChange,
}: {
  directory: Directory;
  /** Called before navigating to compose — closes any surrounding overlay (flyout). */
  onBeforeNavigate?: () => void;
  /** Reports whether the profile modal is open, so the flyout can defer its Escape. */
  onProfileOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<DirectoryCard | null>(null);
  const [preview, setPreview] = useState<DirectoryCard | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  // Keep the flyout informed so a single Escape closes the modal FIRST, not the list.
  useEffect(() => {
    onProfileOpenChange?.(selected !== null);
  }, [selected, onProfileOpenChange]);

  const showPreview = useCallback((u: DirectoryCard, anchor: HTMLElement) => {
    anchorRef.current = anchor;
    setPreview(u);
  }, []);
  const hidePreview = useCallback(() => setPreview(null), []);
  const openProfile = useCallback((u: DirectoryCard) => {
    setPreview(null); // never leave a preview lingering behind the modal
    setSelected(u);
  }, []);

  const handlers: PreviewHandlers = { onOpen: openProfile, onPreview: showPreview, onPreviewEnd: hidePreview };

  // Close the profile modal AND the surrounding flyout before navigating to compose,
  // so no backdrop / body scroll-lock is left behind (§5). The recipient travels as
  // an immutable id and is re-validated server-side on the compose screen.
  function sendMessage(id: string) {
    setSelected(null);
    onBeforeNavigate?.();
    router.push(`/messages/compose?to=${id}`);
  }

  const empty =
    directory.roots.length === 0 && directory.superAdmins.length === 0 && directory.courses.length === 0;

  return (
    <div className="space-y-6">
      <TileGroup title="הנהלת המערכת" cards={directory.roots} handlers={handlers} />
      <TileGroup title="מנהלי־על" cards={directory.superAdmins} handlers={handlers} />
      {directory.courses.map((c) => (
        <div key={c.code} className="space-y-4">
          <h2 className="border-b border-line pb-1 text-base font-semibold text-ink">{c.name}</h2>
          <TileGroup title="מנהלי הקורס" cards={c.admins} handlers={handlers} />
          <TileGroup title="סגל" cards={c.staff} handlers={handlers} />
        </div>
      ))}
      {empty ? <p className="text-sm text-muted">אין משתמשים להצגה.</p> : null}

      {preview ? <Preview key={preview.id} u={preview} anchorRef={anchorRef} /> : null}

      <Dialog open={selected !== null} onClose={() => setSelected(null)} ariaLabel="פרופיל משתמש" className="max-w-md">
        {selected ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-900 text-base font-semibold text-white">
                {displayNameOf(selected).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-base font-semibold text-ink">
                  <span className="truncate">{displayNameOf(selected)}</span>
                  {selected.isRootSuperAdmin ? <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-label="מפקד בית הספר" /> : null}
                </p>
                <p className="truncate text-sm text-muted">{selected.username}</p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-line border-y border-line">
              <ProfileRow label="תפקיד" value={subtitleFor(selected)} />
              {selected.courseType ? <ProfileRow label="קורס" value={COURSE_LABELS[selected.courseType]} /> : null}
            </div>

            {selected.canMessage ? (
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={() => sendMessage(selected.id)} className={buttonClasses({ size: "sm" })}>
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span className="ms-1">שליחת הודעה</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
