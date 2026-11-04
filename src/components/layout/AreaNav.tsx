"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  Contact,
  FileClock,
  Inbox,
  KeyRound,
  Layers,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavIconKey, NavItem } from "@/lib/navigation";

/**
 * Horizontal sub-navigation for the management areas (/admin, /system). The main
 * sidebar is course/cohort-only now, so administration navigates via this bar. RTL,
 * horizontally scrollable on narrow viewports (never a page-level horizontal scroll).
 *
 * Icons are resolved from a SERIALIZABLE `iconKey` here (client-side) — the server
 * layouts pass only plain data, never React components, across the boundary.
 */
const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  trainees: ClipboardList,
  cohorts: Layers,
  access: KeyRound,
  courses: BookOpen,
  logs: FileClock,
  directory: Contact,
  messages: Inbox,
};

export function AreaNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="ניהול המערכת">
      {items.map((item) => {
        const active = isActive(item);
        const Icon = ICONS[item.iconKey];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
              active ? "border-brand-action text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
