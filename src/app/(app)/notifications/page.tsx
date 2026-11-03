import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { NotificationsList } from "@/components/notifications/NotificationsList";
import { getAccount } from "@/lib/auth/account";
import { listNotifications } from "@/lib/data/notifications";

export const metadata = { title: "עדכונים" };
export const dynamic = "force-dynamic";

/**
 * System updates for the user (account/permission/cohort changes and system notices) —
 * NOT a person-to-person messaging inbox. Reached from the user menu ("עדכונים").
 */
export default async function NotificationsPage() {
  const account = await getAccount();
  if (!account) redirect("/");
  if (account.status !== "active") redirect("/");

  const notifications = await listNotifications(account.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="עדכונים" description="עדכוני מערכת: שינויי הרשאה, שיוך למחזור והתראות חשבון." />
      <NotificationsList initial={notifications} />
    </div>
  );
}
