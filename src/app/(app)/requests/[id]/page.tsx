import { notFound, redirect } from "next/navigation";
import { RequestDetail } from "@/components/requests/RequestDetail";
import { getAccount } from "@/lib/auth/account";
import { getRequest } from "@/lib/data/requests";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function RequestDetailPage({ params }: PageProps) {
  const account = await getAccount();
  if (!account) redirect("/login");
  const { id } = await params;
  const request = await getRequest(account, id);
  if (!request) notFound(); // not requester or reviewer → not found

  const isRequester = request.requesterId === account.id;
  return (
    <RequestDetail
      request={{
        id: request.id,
        requestTypeLabel: request.requestTypeLabel,
        requesterName: request.requesterName,
        status: request.status,
        reason: request.reason,
        reviewNote: request.reviewNote,
        targetSummary: request.targetSummary,
        threadId: request.threadId,
      }}
      canReview={!isRequester}
      canCancel={isRequester}
    />
  );
}
