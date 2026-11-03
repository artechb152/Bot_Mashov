import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { DirectoryView } from "@/components/directory/DirectoryView";
import { getAccount } from "@/lib/auth/account";
import { listDirectory } from "@/lib/data/directory";

export const metadata = { title: "אנשי מערכת" };
export const dynamic = "force-dynamic";

/**
 * "אנשי מערכת" as a management page INSIDE the system layout (so the AreaNav stays
 * visible). Reuses the existing directory data + view. No duplicate implementation.
 */
export default async function SystemPeoplePage() {
  const account = await getAccount();
  if (!account) redirect("/");
  if (account.role !== "super_admin" || account.status !== "active") redirect("/workspace");
  const directory = await listDirectory(account);

  return (
    <div className="space-y-6">
      <PageHeader title="אנשי מערכת" description="סגל, מנהלי קורסים והנהלת המערכת." />
      <DirectoryView directory={directory} />
    </div>
  );
}
