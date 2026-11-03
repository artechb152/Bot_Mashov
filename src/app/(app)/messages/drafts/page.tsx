import { redirect } from "next/navigation";
import { DraftList } from "@/components/messages/DraftList";
import { getAccount } from "@/lib/auth/account";
import { listDrafts } from "@/lib/data/messages";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const account = await getAccount();
  if (!account) redirect("/");
  const drafts = await listDrafts(account.id);
  return <DraftList drafts={drafts} />;
}
