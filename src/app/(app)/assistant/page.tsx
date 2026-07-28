import { redirect } from "next/navigation";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { listTrainees, type TraineeDTO } from "@/lib/data/trainees";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAccount } from "@/lib/auth/account";
import { scopeFromSession } from "@/lib/data/scope";

export const metadata = { title: "בוט" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ traineeId?: string }> };

export default async function AssistantPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const account = await getAccount();
  const { traineeId } = await searchParams;

  // Owner + course scoped, so a `?traineeId=` pointing at someone else's trainee
  // (or one from the other course) is simply not in this list and gets dropped.
  // super_admin/root are global (no course) — they may use the general bot but get
  // no course-scoped trainee list; staff/admin without a course still onboard.
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

  return (
    <AssistantChat
      trainees={trainees}
      initialTraineeId={traineeId ?? ""}
      username={user.username}
    />
  );
}
