import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { RequestList } from "@/components/requests/RequestList";
import { getAccount } from "@/lib/auth/account";
import { isAdminRole } from "@/lib/domain/types";
import { listReviewRequests } from "@/lib/data/requests";

export const metadata = { title: "בקשות" };
export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (!isAdminRole(account.role)) redirect("/trainees");

  const requests = await listReviewRequests(account);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="בקשות לטיפול" description="בקשות שהופנו אליך לאישור או דחייה." />
      <RequestList requests={requests} showRequester />
    </div>
  );
}
