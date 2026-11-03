import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { listTrainees, type TraineeDTO } from "@/lib/data/trainees";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccount } from "@/lib/auth/account";
import { scopeFromSession } from "@/lib/data/scope";
import { getWorkspaceNav } from "@/lib/data/workspace-nav";
import { getAIStatus } from "@/lib/ai";

export const metadata = { title: "מרחב עבודה" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ trainee?: string; cohort?: string }> };

/**
 * The trainee-centric work area (Stage 3). Auth is enforced by the (app) layout; the
 * trainee list is owner+course scoped server-side (exactly like the bot page), so a
 * `?trainee=` pointing at someone else's / another course's trainee is simply not in
 * the list and is dropped by the client. super_admin/root are global (no course) and
 * get no course-scoped list here — the cohort/course sidebar arrives in Stage 4.
 */
export default async function WorkspacePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const account = await getAccount();
  const { trainee, cohort } = await searchParams;

  let trainees: TraineeDTO[] = [];
  const scope = scopeFromSession(user);
  if (scope) {
    try {
      trainees = await listTrainees(scope);
    } catch {
      trainees = [];
    }
  } else if (!account || account.role !== "super_admin") {
    redirect("/select-course");
  }

  const ai = getAIStatus();

  // Resolve the cohort the work area opens on (the requested one, else the personal
  // default / assignment / most-recent). Drives which trainees are shown.
  let initialCohortId: string | null = cohort ?? null;
  if (account) {
    try {
      const nav = await getWorkspaceNav(account, cohort ?? null);
      initialCohortId = nav.activeCohortId;
    } catch {
      initialCohortId = cohort ?? null;
    }
  }

  return (
    <Workspace
      trainees={trainees}
      username={user.username}
      ai={ai}
      initialTraineeId={trainee ?? null}
      initialCohortId={initialCohortId}
    />
  );
}
