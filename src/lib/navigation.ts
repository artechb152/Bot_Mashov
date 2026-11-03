import type { RootProfile, UserRole } from "@/lib/domain/types";

/**
 * A serializable icon identifier. NavItems intentionally carry a string `iconKey`
 * (NOT a React component) so a Server Component can pass them to a Client Component
 * (e.g. AreaNav) without violating the "only plain objects" boundary rule. The client
 * maps `iconKey` → a Lucide component locally.
 */
export type NavIconKey =
  | "dashboard"
  | "users"
  | "trainees"
  | "cohorts"
  | "access"
  | "courses"
  | "logs"
  | "directory"
  | "messages";

export type NavItem = {
  /** Hebrew label shown in the navigation. */
  label: string;
  /** Route the item links to. */
  href: string;
  /** Serializable icon key resolved to a component by the client renderer. */
  iconKey: NavIconKey;
  /** Short Hebrew description used on each module's header. */
  description: string;
  /** Match the active state on an EXACT path only (dashboard roots like /admin). */
  exact?: boolean;
  /** Open a flyout panel instead of navigating (the people directory). */
  flyout?: boolean;
};

/**
 * The work area (/workspace) is the home for every role and lives in the sidebar's
 * COURSE → COHORT tree, not as a flat nav item. `navForRole` returns only the FOOTER
 * management links a role may reach (users, cohorts, courses, invites, audit, access
 * requests), rendered as a horizontal AreaNav inside /admin and /system. The old
 * primary items (bot, internal messages, dashboards-as-nav, knowledge) are gone.
 */

/** People directory — opens a flyout (not a route) where wired; a link elsewhere. */
export const DIRECTORY_ITEM: NavItem = {
  label: "אנשי המערכת",
  href: "/directory",
  iconKey: "directory",
  description: "אנשי המערכת — סגל, מנהלים והנהלת המערכת.",
  flyout: true,
};

/** System notifications / updates (NOT the old person-to-person messaging). */
export const NOTIFICATIONS_ITEM: NavItem = {
  label: "הודעות מערכת",
  href: "/notifications",
  iconKey: "messages",
  description: "עדכוני מערכת והתראות.",
};

/**
 * The management area ("ניהול המערכת") is intentionally minimal. Cohort management
 * lives in the sidebar; trainees live in /workspace; access requests were removed;
 * system updates live in the user menu — so none of those appear here.
 *   - admin (course-bound) → just the course's users.
 *   - super_admin/root     → users, access codes, courses, and the audit log.
 */
function adminNav(): NavItem[] {
  return [
    { label: "משתמשים", href: "/admin/users", iconKey: "users", description: "ניהול משתמשי הקורס." },
    { label: "תיקי חניך", href: "/admin/trainees", iconKey: "trainees", description: "כל תיקי החניך בקורס — כלי ניהולי." },
    { label: "אנשי מערכת", href: "/admin/people", iconKey: "directory", description: "בעלי תפקידי ניהול ומערכת." },
  ];
}

function superNav(): NavItem[] {
  return [
    { label: "משתמשים", href: "/system/users", iconKey: "users", description: "ניהול כל המשתמשים." },
    { label: "תיקי חניך", href: "/system/trainees", iconKey: "trainees", description: "כל תיקי החניך במערכת — כלי ניהולי." },
    { label: "אנשי מערכת", href: "/system/people", iconKey: "directory", description: "בעלי תפקידי ניהול ומערכת." },
    { label: "קודי גישה", href: "/system/invites", iconKey: "access", description: "יצירת קודי גישה למשתמשים חדשים." },
    { label: "קורסים", href: "/system/courses", iconKey: "courses", description: "ניהול הקורסים." },
    { label: "יומן מערכת", href: "/system/audit", iconKey: "logs", description: "יומן הביקורת." },
  ];
}

/** The role's MANAGEMENT links, rendered as a horizontal AreaNav in /admin and /system.
 *  Staff have no management links. Plain serializable data (no React components). */
export function navForRole(role: UserRole | undefined, _rootProfile: RootProfile | null = null): NavItem[] {
  if (role === "super_admin") return superNav();
  if (role === "admin") return adminNav();
  return [];
}
