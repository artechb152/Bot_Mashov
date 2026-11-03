"use client";

import { useEffect, useState } from "react";

/**
 * Live `matchMedia` result. Returns `false` until mounted, so use it for behaviour
 * (which panel a toggle drives), never for first-paint layout — that stays in CSS.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}
