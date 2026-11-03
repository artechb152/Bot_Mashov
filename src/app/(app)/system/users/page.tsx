import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SystemUsersList } from "@/components/system/SystemUsersList";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { listAllUsers } from "@/lib/data/admin";

export const metadata = { title: "משתמשים" };
export const dynamic = "force-dynamic";

export default async function SystemUsersPage() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect("/");
  const users = await listAllUsers(auth.grant);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="משתמשים" description="ניהול כלל משתמשי המערכת — סטטוס, שיוך, תפקידים ונראות." />
      <SystemUsersList
        users={users.map((u) => ({
          id: u.id,
          displayName: u.displayName,
          username: u.username,
          role: u.role,
          isRootSuperAdmin: u.isRootSuperAdmin,
          status: u.status,
          adminPosition: u.adminPosition,
          courseType: u.courseType,
          traineeCount: u.traineeCount,
        }))}
      />
    </div>
  );
}
