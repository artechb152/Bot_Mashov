import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { getAccount } from "@/lib/auth/account";
import { listNotifications } from "@/lib/data/notifications";

export const metadata = { title: "התראות" };
export const dynamic = "force-dynamic";

/**
 * Full notifications page (also the deep-link target for the bell drawer). Renders
 * inside the persistent (app) shell — no standalone chrome / back link.
 */
export default async function NotificationsPage() {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.status !== "active") redirect("/login");

  const notifications = await listNotifications(account.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="התראות" description="עדכונים על הודעות, בקשות ושינויים." />
      <NotificationsList initial={notifications} />
    </div>
  );
}
