import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { AreaNav } from "@/components/layout/AreaNav";
import { navForRole } from "@/lib/navigation";

/**
 * The super-admin system management area. The main sidebar is course/cohort-only, so
 * administration navigates via the horizontal {@link AreaNav} rendered here. Only active
 * super_admins reach it; every /api/system/* handler re-checks via requireSuperAdmin().
 */
export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/");
  if (account.role !== "super_admin" || account.status !== "active") redirect("/workspace");
  const items = navForRole(account.role, account.rootProfile);
  return (
    <div>
      <AreaNav items={items} />
      {children}
    </div>
  );
}
