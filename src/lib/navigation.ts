import { Bot, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  /** Hebrew label shown in the navigation. */
  label: string;
  /** Route the item links to. */
  href: string;
  /** Icon rendered beside the label (functional wayfinding, not decoration). */
  icon: LucideIcon;
  /** Short Hebrew description used on each module's header. */
  description: string;
};

/**
 * Primary navigation — the single source of truth for the sidebar and the
 * topbar section title. The product is a focused tool: a coaching & feedback
 * bot, with trainee files behind it. The entry/landing screen lives at `/`
 * (outside the app shell), so it is intentionally NOT a nav item.
 *
 * Other routes still exist in the codebase (dashboard→redirect, feedback,
 * knowledge, simulations, נע״ת, final-exercise) but are intentionally NOT listed
 * here — they are kept as unlinked infrastructure, not part of the nav.
 */
export const navItems: NavItem[] = [
  {
    label: "חניכים",
    href: "/trainees",
    icon: Users,
    description: "ניהול תיקי החניכים — פרטים, חוזקות, פערים והערות.",
  },
  {
    label: "בוט",
    href: "/assistant",
    icon: Bot,
    description: "בוט חניכה ומשוב — התייעצות, ניסוח משוב וניתוח אירוע.",
  },
];
