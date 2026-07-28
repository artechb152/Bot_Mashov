import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { ComposeForm } from "@/components/messages/ComposeForm";

export const dynamic = "force-dynamic";

export default async function ComposePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  const sp = await searchParams;
  const draftId = typeof sp.draft === "string" ? sp.draft : undefined;
  // `to` preselects a recipient (from a profile / user list). It is validated
  // client-side against the server-provided recipient list, which is itself the
  // authorization boundary — an id the sender may not message is never in that list.
  const to = typeof sp.to === "string" ? sp.to : undefined;
  return <ComposeForm draftId={draftId} initialRecipientId={to} />;
}
