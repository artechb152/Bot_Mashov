import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TraineesList } from "@/components/trainees/TraineesList";
import { listTrainees } from "@/lib/data/trainees";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "חניכים" };

// Reads the database on every request — never statically prerendered (keeps the
// build working without a DB, and always shows fresh data).
export const dynamic = "force-dynamic";

export default async function TraineesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const trainees = await listTrainees(user.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="חניכים"
        description="ניהול רשומות החניכים ומעקב ההתקדמות שלהם."
      />
      <TraineesList trainees={trainees} />
    </div>
  );
}
