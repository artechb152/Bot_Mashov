import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TraineeForm } from "@/components/trainees/TraineeForm";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminGetTrainee } from "@/lib/data/admin";

export const metadata = { title: "עריכת חניך" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEditTraineePage({ params }: PageProps) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/");
  const { id } = await params;
  const trainee = await adminGetTrainee(auth.grant, id);
  if (!trainee) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="עריכת חניך" description={`עריכת פרטי ${trainee.fullName}.`} />
      {/* Same form as staff, pointed at the admin API. Ownership + course are not
          part of the editable shape, so an admin edit can't re-home the trainee. */}
      <TraineeForm
        mode="edit"
        initial={trainee}
        apiBase="/api/admin/trainees"
        viewBase="/admin/trainees"
      />
    </div>
  );
}
