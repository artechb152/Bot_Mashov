import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TraineeForm } from "@/components/trainees/TraineeForm";
import { getTrainee } from "@/lib/data/trainees";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "עריכת חניך" };
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditTraineePage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const trainee = await getTrainee(id, user.id);
  if (!trainee) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="עריכת חניך" description={`עריכת פרטי ${trainee.fullName}.`} />
      <TraineeForm mode="edit" initial={trainee} />
    </div>
  );
}
