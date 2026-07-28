import { redirect } from "next/navigation";
import { RequestList } from "@/components/requests/RequestList";
import { getAccount } from "@/lib/auth/account";
import { listMyRequests, listReviewRequests } from "@/lib/data/requests";
import { isAdminRole } from "@/lib/domain/types";

export const metadata = { title: "בקשות" };
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const account = await getAccount();
  if (!account) redirect("/login");

  const [mine, toReview] = await Promise.all([
    listMyRequests(account.id),
    isAdminRole(account.role) ? listReviewRequests(account, { pendingOnly: true }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      {isAdminRole(account.role) ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">בקשות לטיפולך</h2>
          <RequestList requests={toReview} showRequester />
        </section>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">הבקשות שלי</h2>
        <RequestList requests={mine} />
      </section>
    </div>
  );
}
