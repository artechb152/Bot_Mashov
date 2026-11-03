"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management for a modal surface that is not built on `Dialog` (the mobile
 * navigation drawer, the people-directory flyout): while `open`, Escape calls
 * `onClose` (unless `escapeEnabled()` says another layer owns it), Tab is trapped
 * inside `ref`, and focus moves to `initialFocus` (or the panel). On close, focus
 * returns to whatever was focused before — normally the trigger.
 */
export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  options: { initialFocus?: RefObject<HTMLElement | null>; escapeEnabled?: () => boolean } = {},
) {
  const onCloseRef = useRef(onClose);
  const optionsRef = useRef(options);
  useEffect(() => {
    onCloseRef.current = onClose;
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const target = optionsRef.current.initialFocus?.current ?? ref.current;
    // Wait a frame so a panel that was just un-hidden can take focus.
    const frame = requestAnimationFrame(() => target?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      const panel = ref.current;
      if (!panel) return;
      if (event.key === "Escape") {
        const canEscape = optionsRef.current.escapeEnabled?.() ?? true;
        if (canEscape) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, ref]);
}
