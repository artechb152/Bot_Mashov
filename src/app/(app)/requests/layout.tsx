import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getAccount } from "@/lib/auth/account";
import { buttonClasses } from "@/components/ui";
import { MessagesNav } from "@/components/messages/MessagesNav";

/**
 * Requests live in the unified "הודעות ובקשות" area (§25) — same header + sub-nav as
 * the inbox, reached from the תהליכים tab. Inside the persistent (app) shell.
 */
export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/");
  if (account.status !== "active") redirect("/");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">הודעות ובקשות</h1>
      <div className="mt-5">
        <MessagesNav />
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">בקשות</h2>
        <Link href="/requests/new" className={buttonClasses({ size: "sm" })}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="ms-1">בקשה חדשה</span>
        </Link>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
