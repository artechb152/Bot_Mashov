import { redirect } from "next/navigation";
import { AssistantChat } from "@/components/assistant/AssistantChat";
import { listTrainees, type TraineeDTO } from "@/lib/data/trainees";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "בוט" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ traineeId?: string }> };

export default async function AssistantPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { traineeId } = await searchParams;

  let trainees: TraineeDTO[] = [];
  try {
    trainees = await listTrainees(user.id);
  } catch {
    trainees = [];
  }

  return (
    <AssistantChat
      trainees={trainees}
      initialTraineeId={traineeId ?? ""}
      username={user.username}
    />
  );
}
