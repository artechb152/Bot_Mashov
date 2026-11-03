import { redirect } from "next/navigation";
import { ThreadList } from "@/components/messages/ThreadList";
import { getAccount } from "@/lib/auth/account";
import { listThreads } from "@/lib/data/messages";

export const dynamic = "force-dynamic";

export default async function SentPage() {
  const account = await getAccount();
  if (!account) redirect("/");
  const threads = await listThreads(account, "sent");
  return <ThreadList threads={threads} folder="sent" />;
}
