import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { DirectoryView } from "@/components/directory/DirectoryView";
import { getAccount } from "@/lib/auth/account";
import { listDirectory } from "@/lib/data/directory";

export const metadata = { title: "ספר משתמשים" };
export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const account = await getAccount();
  if (!account) redirect("/");
  const directory = await listDirectory(account);

  return (
    <div className="space-y-6">
      <PageHeader title="ספר משתמשים" description="סגל, מנהלי קורסים והנהלת המערכת." />
      <DirectoryView directory={directory} />
    </div>
  );
}
