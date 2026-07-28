import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { RequestList } from "@/components/requests/RequestList";
import { getAccount } from "@/lib/auth/account";
import { listReviewRequests } from "@/lib/data/requests";

export const metadata = { title: "בקשות" };
export const dynamic = "force-dynamic";

export default async function SystemRequestsPage() {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.role !== "super_admin") redirect("/trainees");

  const requests = await listReviewRequests(account);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="בקשות לטיפול" description="בקשות מנהלים ובקשות ברמת מערכת." />
      <RequestList requests={requests} showRequester />
    </div>
  );
}
