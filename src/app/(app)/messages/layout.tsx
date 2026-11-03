import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { MessagesNav } from "@/components/messages/MessagesNav";

/**
 * Internal inbox — cross-role (any active user), now inside the persistent (app)
 * shell. The standalone page chrome + "back to work area" link are gone: the shared
 * sidebar provides navigation. Only the mail sub-nav (דואר folders) stays.
 */
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/");
  if (account.status !== "active") redirect("/");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">הודעות ובקשות</h1>
      <div className="mt-5">
        <MessagesNav />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
