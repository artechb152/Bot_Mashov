import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getAccount } from "@/lib/auth/account";

/**
 * Layout for the "(app)" route group — every section here is wrapped in the
 * sidebar + topbar shell and requires an authenticated user (defense-in-depth
 * alongside middleware). The parenthesized folder name does not affect URLs.
 *
 * Staff/admin require a COURSE: a user whose account predates course modes is sent
 * once to /select-course. super_admin/root are GLOBAL (no course) and are exempt —
 * they must never be shown the course picker.
 *
 * Uses getAccount() (DB-fresh) rather than the cookie alone so the sidebar's
 * admin link reflects the CURRENT role — a promotion/demotion shows up on the
 * next navigation, with no re-login. `cache()` keeps it to one read per request.
 */
export default async function AppSectionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await getAccount();
  if (!account) redirect("/login");
  // Suspended/disabled users are blocked from every protected surface (§4). This is
  // the shared gate for the whole (app) group; area layouts add role checks.
  if (account.status !== "active") redirect("/login");
  if (account.role !== "super_admin" && !account.courseType) redirect("/select-course");
  return (
    <AppShell
      user={{ id: account.id, username: account.username, courseType: account.courseType }}
      role={account.role}
      rootProfile={account.rootProfile}
    >
      {children}
    </AppShell>
  );
}
