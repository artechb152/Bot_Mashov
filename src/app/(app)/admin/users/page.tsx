import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AdminUsersList } from "@/components/admin/AdminUsersList";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listAllUsers } from "@/lib/data/admin";

export const metadata = { title: "משתמשים" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/");
  const users = await listAllUsers(auth.grant);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="משתמשים"
        description="כל משתמשי המערכת — משני הקורסים. פתחו משתמש לצפייה בחניכים ולניהול ההרשאה."
      />
      <AdminUsersList users={users} />
    </div>
  );
}
