"use client";

import { useEffect, useRef } from "react";

const HISTORY_GUARD_KEY = "__chpUnsavedWorkspaceDraft";

/**
 * Warn before losing memory-only trainee feedback drafts.
 *
 * - beforeunload: reload, closing the tab, or full-document navigation
 * - captured link clicks: Next Link navigation out of /workspace
 * - browser Back: a same-URL history entry acts as a guard, because App Router
 *   client navigation does not reliably invoke beforeunload.
 *
 * The history entry keeps the *same URL and Next router state*. When the user
 * accepts Back, the handler steps over the guard and returns to the preceding
 * route. On cancel, the guard entry is reinstated. No trainee content is stored
 * in history or persistent browser storage.
 *
 * Programmatic router.push from elsewhere is not a general-purpose blocker.
 */
export function useUnsavedChangesGuard(active: boolean, message: string, stayPaths: string[] = []) {
  const stayRef = useRef(stayPaths);
  const messageRef = useRef(message);
  useEffect(() => {
    stayRef.current = stayPaths;
    messageRef.current = message;
  });

  useEffect(() => {
    if (!active) return;

    // Add exactly one history guard, including in React Strict Mode effect replay.
    // Keep the currently selected trainee URL and Next's internal history payload.
    function addGuardEntry() {
      if (window.history.state?.[HISTORY_GUARD_KEY]) return;
      window.history.pushState(
        { ...window.history.state, [HISTORY_GUARD_KEY]: true },
        "",
        window.location.href,
      );
    }
    addGuardEntry();

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || stayRef.current.includes(url.pathname)) return;
      if (!window.confirm(messageRef.current)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onPopState = () => {
      // Moving back from the synthetic guard entry reaches the same-URL
      // underlying workspace entry. From there, consent is needed to go farther.
      if (!window.confirm(messageRef.current)) {
        addGuardEntry();
        return;
      }
      window.removeEventListener("popstate", onPopState);
      window.history.back();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [active]);

  // Once every draft was saved/discarded, move from the synthetic same-URL
  // guard entry back to the underlying workspace entry. This avoids requiring
  // two Back presses after the draft was successfully saved.
  const previousActive = useRef(active);
  useEffect(() => {
    if (
      previousActive.current &&
      !active &&
      window.history.state?.[HISTORY_GUARD_KEY]
    ) {
      window.history.back();
    }
    previousActive.current = active;
  }, [active]);
}
