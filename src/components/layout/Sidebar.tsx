"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { navForRole, type NavItem } from "@/lib/navigation";
import { siteConfig } from "@/lib/config";
import { COURSE_LABELS, type CourseType, type RootProfile, type UserRole } from "@/lib/domain/types";

type SidebarProps = {
  /** Extra classes to control display/position (desktop rail vs. mobile drawer). */
  className?: string;
  /** Called after a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
  /** The signed-in user's course — shown quietly in the footer, not as a nav item. */
  courseType?: CourseType | null;
  /** The signed-in user's role — drives the single nav tree. */
  role?: UserRole;
  /** Protected-root profile — drives the crown and the platform-owner nav variant. */
  rootProfile?: RootProfile | null;
  /** Open the people directory flyout (the "אנשי המערכת" item) instead of navigating. */
  onOpenDirectory?: () => void;
};

const ITEM_CLASSES =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-100";

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(ITEM_CLASSES, active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white")}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function FlyoutButton({ item, onClick }: { item: NavItem; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button type="button" onClick={onClick} className={cn(ITEM_CLASSES, "text-slate-300 hover:bg-slate-800/60 hover:text-white")}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

/**
 * The single persistent navigation rail. In RTL it sits on the right; the divider
 * (`border-e`) faces the content column on its inline-end (left) edge. It is shared
 * by every authenticated area (staff/admin/system all live under the `(app)` group),
 * so navigating between areas replaces only the main content — the rail never
 * reloads. The tree is chosen by role + root profile.
 */
export function Sidebar({ className, onNavigate, courseType, role, rootProfile, onOpenDirectory }: SidebarProps) {
  const pathname = usePathname();
  const items = navForRole(role, rootProfile);
  const primary = items.filter((i) => !i.footer);
  const footer = items.filter((i) => i.footer);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <aside
      className={cn(
        "w-64 shrink-0 border-e border-slate-800 bg-slate-900 text-slate-100",
        className,
      )}
    >
      <div className="flex h-full flex-col">
        {/* Brand */}
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-16 items-center gap-3 border-b border-slate-800 px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-100"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-900">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="flex items-center gap-1.5 text-base font-semibold text-white">
              {siteConfig.name}
              {rootProfile === "school_commander" ? (
                <Crown className="h-3.5 w-3.5 text-amber-300" aria-label="מפקד בית הספר" />
              ) : null}
            </span>
            <span className="text-xs text-slate-400">פיקוד וניהול הדרכה</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="ניווט ראשי">
          <p className="px-3 pb-2 text-xs font-medium tracking-wider text-slate-500">תפריט</p>
          <ul className="space-y-1">
            {primary.map((item) => (
              <li key={item.href}>
                <NavLink item={item} active={isActive(item)} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer — the people directory link, then the course context line. */}
        <div className="border-t border-slate-800 px-3 py-4">
          {footer.length > 0 ? (
            <ul className="space-y-1 pb-3">
              {footer.map((item) => (
                <li key={item.href}>
                  {item.flyout && onOpenDirectory ? (
                    <FlyoutButton
                      item={item}
                      onClick={() => {
                        onOpenDirectory();
                        onNavigate?.();
                      }}
                    />
                  ) : (
                    <NavLink item={item} active={isActive(item)} onNavigate={onNavigate} />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="px-3 text-xs text-slate-500">
            סגל ההדרכה
            {courseType ? ` · ${COURSE_LABELS[courseType]}` : ""}
          </p>
        </div>
      </div>
    </aside>
  );
}
