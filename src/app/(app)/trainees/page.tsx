import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TraineesList } from "@/components/trainees/TraineesList";
import { TraineeCohortFilter } from "@/components/trainees/TraineeCohortFilter";
import { listTrainees, listOwnedCohorts } from "@/lib/data/trainees";
import { getCurrentUser } from "@/lib/auth/current-user";
import { scopeFromSession } from "@/lib/data/scope";

export const metadata = { title: "תיקי חניך" };

// Reads the database on every request — never statically prerendered.
export const dynamic = "force-dynamic";

export default async function TraineesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const scope = scopeFromSession(user);
  if (!scope) redirect("/select-course");

  const sp = await searchParams;
  const cohortParam = typeof sp.cohort === "string" ? sp.cohort : "all";

  const [trainees, cohorts] = await Promise.all([
    listTrainees(scope, cohortParam !== "all" ? { cohortId: cohortParam } : {}),
    listOwnedCohorts(scope),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="תיקי חניך" description="ניהול רשומות החניכים ומעקב ההתקדמות שלהם." />
      <TraineeCohortFilter cohorts={cohorts} selected={cohortParam} />
      <TraineesList trainees={trainees} />
    </div>
  );
}
