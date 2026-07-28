import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TraineeForm } from "@/components/trainees/TraineeForm";
import { readTraineeById } from "@/lib/data/trainees";
import { requireTraineeAccess } from "@/lib/auth/access";

export const metadata = { title: "עריכת חניך" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditTraineePage({ params }: PageProps) {
  const { id } = await params;
  // WRITE gate: owner, an active EDIT grant, a course admin, or a super-admin may
  // open the edit form. A view-grant holder or a stranger gets 404 (and the locked
  // cohort is refused). The same edit form + protected PATCH API are reused — no
  // duplicate form. The API re-authorizes every save via requireTraineeAccess.
  const access = await requireTraineeAccess(id, { write: true });
  if (!access.ok) notFound();
  const trainee = await readTraineeById(id);
  if (!trainee) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="עריכת חניך" description={`עריכת פרטי ${trainee.fullName}.`} />
      <TraineeForm mode="edit" initial={trainee} />
    </div>
  );
}
