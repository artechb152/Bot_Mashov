"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { buttonClasses, NavigationArrow } from "@/components/ui";

/**
 * One reusable "back" control (§17). Priority:
 *   1. a validated internal `?from=` return path (preserves the list + its filters),
 *   2. browser history (in-app navigation),
 *   3. a role-safe fallback href.
 * Only same-origin absolute paths ("/...") are honored for `from`, so it can never
 * be turned into an open redirect.
 */
export function SmartBackButton({
  fallbackHref,
  label = "חזרה",
  className,
}: {
  fallbackHref: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from");
  const internalFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : null;

  function goBack() {
    if (internalFrom) {
      router.push(internalFrom);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={buttonClasses({ variant: "secondary", size: "sm" }) + (className ? ` ${className}` : "")}
    >
      <NavigationArrow direction="back" />
      {label}
    </button>
  );
}
