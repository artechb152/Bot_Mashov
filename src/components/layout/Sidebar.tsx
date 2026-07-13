"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass } from "lucide-react";
import { cn } from "@/lib/cn";
import { navItems } from "@/lib/navigation";
import { siteConfig } from "@/lib/config";

type SidebarProps = {
  /** Extra classes to control display/position (desktop rail vs. mobile drawer). */
  className?: string;
  /** Called after a nav link is clicked (used to close the mobile drawer). */
  onNavigate?: () => void;
};

/**
 * Dark navigation rail. In RTL it naturally sits on the right; the divider
 * (`border-e`) faces the content column on its inline-end (left) edge.
 */
export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

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
            <span className="text-base font-semibold text-white">{siteConfig.name}</span>
            <span className="text-xs text-slate-400">פיקוד וניהול הדרכה</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="ניווט ראשי">
          <p className="px-3 pb-2 text-xs font-medium tracking-wider text-slate-500">תפריט</p>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-100",
                      active
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-4">
          <p className="text-xs text-slate-500">סגל ההדרכה</p>
        </div>
      </div>
    </aside>
  );
}
