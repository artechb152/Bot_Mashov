"use client";

import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Options for {@link useAnchoredPosition}. All distances are CSS pixels.
 */
export type AnchoredPositionOptions = {
  /** Space between the anchor and the panel. */
  gap?: number;
  /** Minimum breathing room kept from every viewport edge. */
  margin?: number;
  /** Preferred panel width; capped to the viewport when the screen is narrow. */
  width?: number;
  /** Hard upper bound on the panel height (its list scrolls beyond this). */
  maxHeight?: number;
};

/**
 * Dynamic, collision-aware positioning for a `position: fixed` panel (a popover /
 * dropdown) anchored to a trigger element — with no third-party dependency.
 *
 * It reads the trigger's real position from the DOM (`getBoundingClientRect`) and
 * computes a viewport-relative placement, so the panel is never clipped by an
 * ancestor's `overflow`/`transform` and works on any page regardless of the top
 * bar's structure. Rules:
 *  - Default below the trigger; flip above when there is more room there.
 *  - RTL-aware horizontally: align the panel's inline-end (right, in RTL) edge to
 *    the trigger, then clamp so it stays fully on-screen with a `margin` gutter.
 *  - Cap the height to the available space (and to `maxHeight`) so a tall list
 *    scrolls internally instead of overflowing the viewport.
 *  - Recompute on scroll (capture, any container) and resize (covers browser zoom,
 *    which changes the CSS-pixel viewport and fires `resize`).
 *
 * Returns an inline style; starts hidden until the first synchronous measurement
 * (in `useLayoutEffect`, before paint) so the panel never flashes at the wrong spot.
 */
export function useAnchoredPosition<T extends HTMLElement>(
  anchorRef: RefObject<T | null>,
  open: boolean,
  options: AnchoredPositionOptions = {},
): CSSProperties {
  const { gap = 8, margin = 12, width: baseWidth = 320, maxHeight: heightCap = 420 } = options;

  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    top: 0,
    insetInlineStart: 0,
    visibility: "hidden",
  });

  const compute = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Width never exceeds the viewport (minus the edge gutters).
    const width = Math.min(baseWidth, vw - margin * 2);

    // Horizontal: in RTL align the panel's right edge to the trigger's right edge
    // (grow toward inline-start); in LTR align left edges. Then clamp on-screen.
    const isRtl = getComputedStyle(anchor).direction === "rtl";
    const preferredLeft = isRtl ? rect.right - width : rect.left;
    const maxLeft = vw - width - margin;
    const left = Math.max(margin, Math.min(preferredLeft, maxLeft));

    // Vertical: prefer below; flip above when it has more usable room.
    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const placeBelow = spaceBelow >= heightCap || spaceBelow >= spaceAbove;
    const available = Math.max(0, placeBelow ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(heightCap, available);

    setStyle({
      position: "fixed",
      left,
      width,
      maxHeight,
      visibility: "visible",
      ...(placeBelow ? { top: rect.bottom + gap } : { bottom: vh - rect.top + gap }),
    });
  }, [anchorRef, gap, margin, baseWidth, heightCap]);

  useLayoutEffect(() => {
    if (!open) return;
    compute();
    // Capture-phase scroll catches scrolling in any ancestor container, not just
    // the window. `passive` keeps scrolling smooth; both handlers just reposition.
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, { capture: true } as EventListenerOptions);
    };
  }, [open, compute]);

  return style;
}
