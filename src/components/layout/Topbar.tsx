"use client";

import { Menu } from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import type { SessionUser } from "@/lib/auth/session";

type TopbarProps = {
  user: SessionUser;
  /** Toggles the mobile navigation drawer. */
  onMenuClick?: () => void;
};

/**
 * Slim top bar: mobile menu toggle + the user menu (upper-right of the content
 * area). The section title lives in each page's PageHeader, so it is not
 * duplicated here.
 */
export function Topbar({ user, onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 lg:hidden"
        aria-label="פתיחת תפריט הניווט"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <UserMenu username={user.username} />
    </header>
  );
}
