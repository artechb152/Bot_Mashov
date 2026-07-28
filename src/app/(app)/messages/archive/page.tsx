import { redirect } from "next/navigation";
import { ThreadList } from "@/components/messages/ThreadList";
import { getAccount } from "@/lib/auth/account";
import { listThreads } from "@/lib/data/messages";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const account = await getAccount();
  if (!account) redirect("/login");
  const threads = await listThreads(account, "archive");
  return <ThreadList threads={threads} folder="archive" />;
}
