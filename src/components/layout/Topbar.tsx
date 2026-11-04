"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type TopbarProps = {
  /** Toggles the mobile navigation drawer. */
  onMenuClick: () => void;
  menuOpen: boolean;
  home: string;
};

/**
 * The phone/tablet top bar (<1024px), on every route including the work area: the
 * navigation drawer toggle, the wordmark (home) and the updates bell. From `lg` up the
 * sidebar carries all of this, so there is no desktop top bar to duplicate it.
 */
export function Topbar({ onMenuClick, menuOpen, home }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 pt-[env(safe-area-inset-top)] lg:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        aria-label="תפריט הניווט"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>
      <Link href={home} className="rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <BrandWordmark tone="onLight" size="sm" />
      </Link>
      <div className="ms-auto">
        <NotificationBell />
      </div>
    </header>
  );
}
