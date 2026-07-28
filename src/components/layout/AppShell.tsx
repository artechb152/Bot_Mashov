"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/auth/session";
import type { RootProfile, UserRole } from "@/lib/domain/types";
import { DirectoryFlyout } from "@/components/directory/DirectoryFlyout";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Client shell that composes the sidebar + topbar around page content and
 * manages the mobile navigation drawer. In RTL the rail sits on the right and
 * the mobile drawer slides in from the inline-start (right) edge.
 *
 * The bot page (`/assistant`) is a full-screen chat: it drops the section
 * topbar and fills the whole viewport height with its own single work bar. On
 * that route the mobile nav toggle becomes a small floating button so the
 * drawer stays reachable without adding a second bar.
 */
export function AppShell({
  children,
  user,
  role,
  rootProfile,
}: {
  children: React.ReactNode;
  user: SessionUser;
  /** The current user's role — controls the single nav tree. */
  role?: UserRole;
  /** Protected-root profile — drives the crown + platform-owner nav variant. */
  rootProfile?: RootProfile | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const pathname = usePathname();
  const isChat = pathname === "/assistant";
  const openDirectory = () => setDirectoryOpen(true);

  return (
    <div className={cn("lg:flex", isChat ? "h-dvh overflow-hidden" : "min-h-screen")}>
      {/* People directory flyout (opened from the sidebar "אנשי המערכת" item) */}
      <DirectoryFlyout open={directoryOpen} onClose={() => setDirectoryOpen(false)} />

      {/* Desktop rail */}
      <Sidebar
        courseType={user.courseType}
        role={role}
        rootProfile={rootProfile}
        onOpenDirectory={openDirectory}
        className="sticky top-0 hidden h-screen self-start lg:block"
      />

      {/* Mobile drawer + backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/50 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <Sidebar
        courseType={user.courseType}
        role={role}
        rootProfile={rootProfile}
        onOpenDirectory={openDirectory}
        onNavigate={() => setMobileOpen(false)}
        className={cn(
          "fixed inset-y-0 start-0 z-50 shadow-xl transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
      />

      {/* Content column */}
      <div className={cn("flex min-w-0 flex-1 flex-col", isChat ? "h-dvh overflow-hidden" : "min-h-screen")}>
        {isChat ? (
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="פתיחת תפריט הניווט"
            aria-expanded={mobileOpen}
            className="fixed start-2 top-2 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface/90 text-muted shadow-sm backdrop-blur transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <Topbar user={user} onMenuClick={() => setMobileOpen((open) => !open)} />
        )}
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1 focus:outline-none",
            isChat ? "min-h-0 overflow-hidden" : "p-4 sm:p-6 lg:p-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
