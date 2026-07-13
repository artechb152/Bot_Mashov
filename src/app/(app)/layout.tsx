import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Layout for the "(app)" route group — every section here is wrapped in the
 * sidebar + topbar shell and requires an authenticated user (defense-in-depth
 * alongside middleware). The parenthesized folder name does not affect URLs.
 */
export default async function AppSectionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <AppShell user={user}>{children}</AppShell>;
}
