import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { isAdminRole } from "@/lib/domain/types";

/**
 * Page-level gate for the management area. It now lives INSIDE the persistent (app)
 * shell (one shared sidebar), so this layout only enforces the role — the shell and
 * navigation come from `(app)/layout.tsx`. The /api/admin/* handlers re-check via
 * requireAdmin() (DB-fresh), so a user demoted a moment ago is bounced on their next
 * navigation.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (!isAdminRole(account.role)) redirect("/trainees");
  return <>{children}</>;
}
