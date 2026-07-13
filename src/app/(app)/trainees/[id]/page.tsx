import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Bot } from "lucide-react";
import { buttonClasses, PageHeader, Panel } from "@/components/ui";
import { DeleteTraineeButton } from "@/components/trainees/DeleteTraineeButton";
import { TraineeAttachments } from "@/components/trainees/TraineeAttachments";
import { getTrainee } from "@/lib/data/trainees";
import { listAttachments } from "@/lib/data/attachments";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return { title: "חניך" };
  const { id } = await params;
  const trainee = await getTrainee(id, user.id).catch(() => null);
  return { title: trainee ? trainee.fullName : "חניך" };
}

function ItemList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="mt-2 text-sm text-muted">{emptyText}</p>;
  }
  return (
    <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted marker:text-line-strong">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default async function TraineeProfilePage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const trainee = await getTrainee(id, user.id);
  if (!trainee) notFound();
  const attachments = await listAttachments(trainee.id, user.id);

  const meta = trainee.team ? `צוות ${trainee.team}` : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/trainees" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה לרשימת החניכים
        </Link>
      </div>

      <PageHeader
        title={trainee.fullName}
        description={meta ? `תיק חניך · ${meta}` : "תיק חניך"}
        actions={
          <>
            <Link href={`/assistant?traineeId=${trainee.id}`} className={buttonClasses()}>
              <Bot className="h-4 w-4" aria-hidden="true" />
              פתיחת בוט עם חניך זה
            </Link>
            <Link
              href={`/trainees/${trainee.id}/edit`}
              className={buttonClasses({ variant: "secondary" })}
            >
              עריכה
            </Link>
            <DeleteTraineeButton id={trainee.id} name={trainee.fullName} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <h3 className="text-sm font-semibold text-ink">חוזקות</h3>
          <ItemList items={trainee.strengths} emptyText="לא הוזנו חוזקות." />
        </Panel>
        <Panel>
          <h3 className="text-sm font-semibold text-ink">חולשות</h3>
          <ItemList items={trainee.weaknesses} emptyText="לא הוזנו חולשות." />
        </Panel>
      </div>

      <Panel>
        <h3 className="text-sm font-semibold text-ink">הערות מפקד/חונך</h3>
        {trainee.notes ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{trainee.notes}</p>
        ) : (
          <p className="mt-2 text-sm text-muted">אין הערות.</p>
        )}
      </Panel>

      <TraineeAttachments traineeId={trainee.id} initial={attachments} />
    </div>
  );
}
