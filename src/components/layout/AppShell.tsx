"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/auth/session";
import type { RootProfile, UserRole } from "@/lib/domain/types";
import { useModalFocus } from "@/lib/hooks/useModalFocus";
import { DirectoryFlyout } from "@/components/directory/DirectoryFlyout";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { WorkspaceNav } from "@/lib/data/workspace-nav";

/**
 * Client shell: the navigation rail + page content, the phone navigation drawer and
 * the people-directory flyout. In RTL the rail sits on the right and the drawer slides
 * in from the inline-start (right) edge.
 *
 * - >=1024px: the rail is always visible and holds all navigation, updates and the
 *   account menu — there is no desktop top bar.
 * - <1024px: a slim top bar (menu · wordmark · updates) on every route; the rail opens
 *   as a modal drawer (focus trapped, Escape closes, focus returns to the toggle).
 *
 * The work area (/workspace) is full-bleed: it fills the viewport height and manages
 * its own scrolling; other routes scroll the document with standard page padding.
 */
export function AppShell({
  children,
  user,
  role,
  rootProfile,
  nav,
}: {
  children: React.ReactNode;
  user: SessionUser;
  /** The current user's role — controls the single nav tree. */
  role?: UserRole;
  /** Protected-root profile — drives the crown + platform-owner nav variant. */
  rootProfile?: RootProfile | null;
  /** Course → cohort tree + resolved active cohort (absent for platform-owner). */
  nav?: WorkspaceNav | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  // Full-bleed surfaces manage their own height + scrolling.
  const fullBleed = pathname === "/assistant" || pathname === "/workspace";
  const home = rootProfile === "platform_owner" ? "/system/users" : "/workspace";

  const closeDrawer = useCallback(() => setMobileOpen(false), []);
  useModalFocus(drawerRef, mobileOpen, closeDrawer);

  // Close the drawer when the route changes (e.g. browser back).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // From the drawer, the directory replaces it (one overlay at a time).
  const openDirectory = useCallback(() => {
    setMobileOpen(false);
    setDirectoryOpen(true);
  }, []);

  const sidebarProps = {
    courseType: user.courseType,
    role,
    rootProfile,
    username: user.username,
    nav,
    onOpenDirectory: openDirectory,
  };

  return (
    <div className={cn("lg:flex", fullBleed ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-surface px-4 py-2 text-sm font-medium text-ink shadow-lg focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        דילוג לתוכן הראשי
      </a>

      <DirectoryFlyout open={directoryOpen} onClose={() => setDirectoryOpen(false)} />

      {/* Desktop rail */}
      <Sidebar {...sidebarProps} className="sticky top-0 hidden h-dvh self-start lg:block" />

      {/* Phone drawer + backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/50 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="תפריט הניווט"
        tabIndex={-1}
        inert={!mobileOpen}
        className={cn(
          "fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] transition-transform duration-200 ease-out focus:outline-none lg:hidden",
          mobileOpen ? "translate-x-0 shadow-xl" : "translate-x-full",
        )}
      >
        <Sidebar {...sidebarProps} onNavigate={closeDrawer} className="h-full w-full" />
      </div>

      {/* Content column */}
      <div className={cn("flex min-w-0 flex-1 flex-col", fullBleed ? "h-dvh overflow-hidden" : "min-h-dvh")}>
        <Topbar home={home} menuOpen={mobileOpen} onMenuClick={() => setMobileOpen((open) => !open)} />
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1 focus:outline-none",
            fullBleed ? "min-h-0 overflow-hidden" : "p-4 sm:p-6 lg:p-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
