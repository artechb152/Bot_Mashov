import { notFound, redirect } from "next/navigation";
import { ThreadView } from "@/components/messages/ThreadView";
import { getAccount } from "@/lib/auth/account";
import { getThreadForUser } from "@/lib/data/messages";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ threadId: string }> };

export default async function ThreadPage({ params }: PageProps) {
  const account = await getAccount();
  if (!account) redirect("/login");
  const { threadId } = await params;
  const thread = await getThreadForUser(account, threadId);
  if (!thread) notFound(); // not a participant → not found (no probing)
  return <ThreadView thread={thread} />;
}
