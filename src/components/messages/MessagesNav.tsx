"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, Send, FileText, Archive, ClipboardList, PenSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui";

/** דואר (mail folders) — the internal inbox. */
const mailTabs = [
  { label: "דואר נכנס", href: "/messages/inbox", icon: Inbox },
  { label: "נשלחו", href: "/messages/sent", icon: Send },
  { label: "טיוטות", href: "/messages/drafts", icon: FileText },
  { label: "ארכיון", href: "/messages/archive", icon: Archive },
];

const tabClass = (active: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
    active ? "bg-ink text-white" : "text-muted hover:bg-surface-2 hover:text-ink",
  );

/**
 * The single "הודעות ובקשות" sub-navigation (§25): a דואר group (inbox/sent/drafts/
 * archive) and a תהליכים group (בקשות). Rendered in both the messages and requests
 * layouts so the area feels unified; requests are reached here, not from a separate
 * sidebar link.
 */
export function MessagesNav() {
  const pathname = usePathname();
  const requestsActive = pathname === "/requests" || pathname.startsWith("/requests/");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav className="flex flex-wrap items-center gap-1" aria-label="הודעות ובקשות">
        {mailTabs.map((t) => {
          const active = pathname === t.href;
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
        <Link href="/requests" aria-current={requestsActive ? "page" : undefined} className={tabClass(requestsActive)}>
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          בקשות
        </Link>
      </nav>
      <Link href="/messages/compose" className={buttonClasses({ size: "sm" })}>
        <PenSquare className="h-4 w-4" aria-hidden="true" />
        <span className="ms-1">כתיבת הודעה</span>
      </Link>
    </div>
  );
}
