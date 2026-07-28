"use client";

import { Menu } from "lucide-react";
import { UserMenu } from "@/components/layout/UserMenu";
import { SettingsButton } from "@/components/layout/SettingsButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { SessionUser } from "@/lib/auth/session";

type TopbarProps = {
  user: SessionUser;
  /** Toggles the mobile navigation drawer. */
  onMenuClick?: () => void;
};

/**
 * Slim top bar with a stable two-side layout (§2). The account cluster — the
 * notification bell + the user card — hugs the inline-start (right, in RTL). The
 * settings gear stands alone at the inline-end (left), pushed there by its own
 * `ms-auto` so it stays pinned at the edge regardless of the username width. The
 * mobile nav toggle leads the inline-start on small screens.
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

      {/* Right (inline-start): notifications + user card */}
      <div className="flex items-center gap-3">
        <NotificationBell />
        <UserMenu username={user.username} />
      </div>

      {/* Left (inline-end): settings gear, pinned to the far edge */}
      <SettingsButton className="ms-auto" />
    </header>
  );
}
