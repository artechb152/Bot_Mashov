"use client";

import { useEffect, useRef } from "react";

/**
 * Warns before unsaved work is discarded by leaving the page: a native
 * `beforeunload` prompt for reloads/closing the tab, and a confirm() for in-app
 * link clicks. Links to a path in `stayPaths` are allowed through silently — e.g.
 * switching cohorts inside /workspace keeps the in-memory drafts alive.
 */
export function useUnsavedChangesGuard(active: boolean, message: string, stayPaths: string[] = []) {
  const stayRef = useRef(stayPaths);
  useEffect(() => {
    stayRef.current = stayPaths;
  });

  useEffect(() => {
    if (!active) return;

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
      if (url.origin !== window.location.origin) return;
      if (stayRef.current.includes(url.pathname)) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase so the check runs before Next.js' <Link> handler navigates.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, message]);
}
