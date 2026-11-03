import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { isAdminRole } from "@/lib/domain/types";
import { AreaNav } from "@/components/layout/AreaNav";
import { navForRole } from "@/lib/navigation";

/**
 * The management area ("ניהול המערכת"). The main sidebar is course/cohort-only, so
 * administration navigates via the horizontal {@link AreaNav} rendered here. Enforces
 * the role; every /api/admin/* handler re-checks via requireAdmin() (DB-fresh).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/");
  if (!isAdminRole(account.role)) redirect("/workspace");
  const items = navForRole(account.role, account.rootProfile);
  return (
    <div>
      <AreaNav items={items} />
      {children}
    </div>
  );
}
