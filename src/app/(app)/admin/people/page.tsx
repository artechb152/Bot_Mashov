import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { DirectoryView } from "@/components/directory/DirectoryView";
import { getAccount } from "@/lib/auth/account";
import { isAdminRole } from "@/lib/domain/types";
import { listDirectory } from "@/lib/data/directory";

export const metadata = { title: "אנשי מערכת" };
export const dynamic = "force-dynamic";

/**
 * "אנשי מערכת" as a management page INSIDE the admin layout (so the AreaNav stays
 * visible). Reuses the existing directory data + view — bearers of management/system
 * roles grouped separately from regular course staff. No duplicate implementation.
 */
export default async function AdminPeoplePage() {
  const account = await getAccount();
  if (!account) redirect("/");
  if (!isAdminRole(account.role)) redirect("/workspace");
  const directory = await listDirectory(account);

  return (
    <div className="space-y-6">
      <PageHeader title="אנשי מערכת" description="סגל, מנהלי קורסים והנהלת המערכת." />
      <DirectoryView directory={directory} />
    </div>
  );
}
