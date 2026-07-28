import {
  Bot,
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
import type { RootProfile, UserRole } from "@/lib/domain/types";

export type NavItem = {
  /** Hebrew label shown in the navigation. */
  label: string;
  /** Route the item links to. */
  href: string;
  /** Icon rendered beside the label (functional wayfinding, not decoration). */
  icon: LucideIcon;
  /** Short Hebrew description used on each module's header. */
  description: string;
  /**
   * Match the active state on an EXACT path only (used for dashboard roots like
   * `/admin` and `/system`, so they don't light up on every sub-page).
   */
  exact?: boolean;
  /** Render this item pinned at the bottom of the rail (the directory / people link). */
  footer?: boolean;
  /** Open a flyout panel instead of navigating (the people directory, §18). */
  flyout?: boolean;
};

/**
 * ONE role-specific navigation tree — the single source of truth for the persistent
 * sidebar (§14). Every authenticated area now lives under the `(app)` route group
 * and shares one shell, so a user sees exactly one tree (no separate staff/admin/
 * system rails). Settings is NOT a nav item — it is reached from the account gear
 * (§15). The people/"אנשי המערכת" link is pinned to the bottom (`footer`).
 */

const BOT: NavItem = {
  label: "בוט חניכה ומשוב",
  href: "/assistant",
  icon: Bot,
  description: "בוט חניכה ומשוב — התייעצות, ניסוח משוב וניתוח אירוע.",
};

// One "הודעות ובקשות" area (§25): mail + requests live together; requests are
// reached from the messages sub-nav, not a separate sidebar link.
const MESSAGES: NavItem = {
  label: "הודעות ובקשות",
  href: "/messages",
  icon: Inbox,
  description: "תיבת הדואר הפנימית ובקשות גישה ושינוי.",
};

const DIRECTORY: NavItem = {
  label: "אנשי המערכת",
  href: "/directory",
  icon: Contact,
  description: "אנשי המערכת — סגל, מנהלים והנהלת המערכת.",
  footer: true,
  flyout: true,
};

function staffNav(): NavItem[] {
  return [
    BOT,
    { label: "תיקי החניך שלי", href: "/trainees", icon: Users, description: "ניהול תיקי החניכים שלך." },
    MESSAGES,
    DIRECTORY,
  ];
}

function adminNav(): NavItem[] {
  return [
    { label: "סקירת קורס", href: "/admin", icon: LayoutDashboard, description: "סקירת הקורס.", exact: true },
    BOT,
    { label: "משתמשי הקורס", href: "/admin/users", icon: Users, description: "סגל הקורס." },
    { label: "תיקי חניך", href: "/admin/trainees", icon: ClipboardList, description: "כל תיקי החניך בקורס." },
    { label: "מחזורים וצוותים", href: "/admin/cohorts", icon: Layers, description: "ניהול מחזורים וצוותים." },
    MESSAGES,
    DIRECTORY,
  ];
}

function superNav(rootProfile: RootProfile | null): NavItem[] {
  const items: NavItem[] = [
    { label: "סקירת מערכת", href: "/system", icon: LayoutDashboard, description: "סקירת המערכת.", exact: true },
  ];
  // The platform-owner root is administration-only — no bot / personal work area (§14).
  if (rootProfile !== "platform_owner") items.push(BOT);
  items.push(
    { label: "ניהול משתמשים", href: "/system/users", icon: Users, description: "ניהול כל המשתמשים." },
    { label: "כל תיקי החניך", href: "/system/trainees", icon: ClipboardList, description: "כל תיקי החניך במערכת." },
    { label: "קורסים", href: "/system/courses", icon: BookOpen, description: "ניהול הקורסים." },
    { label: "מחזורים וצוותים", href: "/system/cohorts", icon: Layers, description: "ניהול מחזורים וצוותים." },
    { label: "קודי הרשאה", href: "/system/invites", icon: KeyRound, description: "קודי הזמנת מנהלים." },
    MESSAGES,
    { label: "יומן פעולות", href: "/system/audit", icon: FileClock, description: "יומן הביקורת." },
    DIRECTORY,
  );
  return items;
}

/** The single navigation tree for a given role + root profile. */
export function navForRole(role: UserRole | undefined, rootProfile: RootProfile | null = null): NavItem[] {
  if (role === "super_admin") return superNav(rootProfile);
  if (role === "admin") return adminNav();
  return staffNav();
}
