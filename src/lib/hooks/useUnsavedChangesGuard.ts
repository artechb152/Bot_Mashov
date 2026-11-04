"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Marks the synthetic same-URL entry pushed while unsaved work exists. */
const GUARD_KEY = "__chpDraftGuard";
/** Marks the real entry directly underneath it — reaching it means "Back" was pressed. */
const BASE_KEY = "__chpDraftGuardBase";

type HistoryState = Record<string, unknown> | null;

function currentState(): HistoryState {
  const state = window.history.state as unknown;
  return state && typeof state === "object" ? (state as Record<string, unknown>) : null;
}

function withoutMarkers(state: HistoryState): Record<string, unknown> {
  const rest = { ...(state ?? {}) };
  delete rest[GUARD_KEY];
  delete rest[BASE_KEY];
  return rest;
}

/** Push the guard entry (once): mark the current entry as its base, then push a same-URL copy. */
function addGuardEntry() {
  const state = currentState();
  if (state?.[GUARD_KEY]) return;
  const clean = withoutMarkers(state);
  const href = window.location.href;
  window.history.replaceState({ ...clean, [BASE_KEY]: true }, "", href);
  window.history.pushState({ ...clean, [GUARD_KEY]: true }, "", href);
}

/**
 * Warn before losing memory-only trainee feedback drafts.
 *
 * - beforeunload: reload, closing the tab, or full-document navigation.
 * - captured link clicks: Next Link navigation out of the work area. Links to a path
 *   in `stayPaths` (cohort switches inside /workspace) pass through silently.
 * - browser Back: App Router client navigation never fires beforeunload, so while
 *   drafts exist a same-URL guard entry sits on top of a marked base entry. Landing
 *   on the base entry means Back was pressed: cancel re-adds the guard, accept steps
 *   past the base. Moves between other entries (e.g. Back to the previous cohort
 *   inside the work area) land on unmarked entries and pass through silently.
 *
 * The guard keeps the same URL and Next's history payload; no trainee content is
 * stored in history or persistent browser storage. `onRestore` re-applies in-app state
 * to the URL after a history move lands on an entry that predates the current
 * selection (selection is mirrored with replaceState, which only rewrites the top
 * entry). Programmatic router.push from elsewhere is not blocked.
 */
export function useUnsavedChangesGuard(
  active: boolean,
  message: string,
  stayPaths: string[] = [],
  onRestore?: () => void,
) {
  const router = useRouter();
  const stayRef = useRef(stayPaths);
  const messageRef = useRef(message);
  const restoreRef = useRef(onRestore);
  useEffect(() => {
    stayRef.current = stayPaths;
    messageRef.current = message;
    restoreRef.current = onRestore;
  });

  useEffect(() => {
    if (!active) return;
    // Idempotent, so React Strict Mode's effect replay does not stack guards.
    addGuardEntry();

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need a return value to show the prompt.
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || stayRef.current.includes(url.pathname)) return;
      // Capture phase, so this runs before Next's <Link> handler navigates.
      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm(messageRef.current)) return;
      leave(() => router.push(url.pathname + url.search + url.hash));
    };

    const onPopState = () => {
      if (!currentState()?.[BASE_KEY]) return;
      if (!window.confirm(messageRef.current)) {
        addGuardEntry();
        restoreRef.current?.();
        return;
      }
      detach();
      window.history.back();
    };

    /** Drop the guard entry first, so a later Back from `target` reaches /workspace once. */
    function leave(go: () => void) {
      detach();
      if (!currentState()?.[GUARD_KEY]) return go();
      window.addEventListener("popstate", go, { once: true });
      window.history.back();
    }

    function detach() {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return detach;
  }, [active, router]);

  // Once every draft is saved or discarded, step off the guard entry so a single
  // Back leaves the work area, and keep the URL on the current selection.
  const wasActive = useRef(active);
  useEffect(() => {
    if (wasActive.current && !active && currentState()?.[GUARD_KEY]) {
      window.addEventListener("popstate", () => restoreRef.current?.(), { once: true });
      window.history.back();
    }
    wasActive.current = active;
  }, [active]);
}
