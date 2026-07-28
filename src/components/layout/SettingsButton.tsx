import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The account SETTINGS gear — a single shared control (§6). It lives OUTSIDE the
 * user card and is pinned to the fixed inline-end (left, in RTL) of the top bar, in
 * the same place on every authenticated page. Keyboard-accessible, with a Hebrew
 * tooltip + aria-label.
 */
export function SettingsButton({ className }: { className?: string }) {
  return (
    <Link
      href="/settings/profile"
      aria-label="הגדרות"
      title="הגדרות"
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
        className,
      )}
    >
      <Settings className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
