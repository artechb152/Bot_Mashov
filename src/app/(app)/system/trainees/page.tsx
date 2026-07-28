import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AdminTraineesList } from "@/components/admin/AdminTraineesList";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { listAllTrainees, listAllUsers } from "@/lib/data/admin";

export const metadata = { title: "כל תיקי החניך" };
export const dynamic = "force-dynamic";

export default async function SystemTraineesPage() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect("/login");

  const [trainees, users] = await Promise.all([listAllTrainees(auth.grant), listAllUsers(auth.grant)]);
  const staff = users.filter((u) => u.role === "staff").map((u) => ({ id: u.id, label: u.displayName || u.username }));
  const ownerLabels: Record<string, string> = {};
  for (const u of users) ownerLabels[u.id] = u.displayName || u.username;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="כל תיקי החניך" description="כל תיקי החניך בכל הקורסים." />
      <AdminTraineesList
        trainees={trainees.map((t) => ({ id: t.id, fullName: t.fullName, ownerId: t.ownerId, status: t.status }))}
        staff={staff}
        ownerLabels={ownerLabels}
      />
    </div>
  );
}
