import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { buttonClasses, PageHeader, Panel } from "@/components/ui";
import { TraineeAttachments } from "@/components/trainees/TraineeAttachments";
import { GrantsPanel } from "@/components/admin/GrantsPanel";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminGetTrainee, adminListAttachments, getAdminUser } from "@/lib/data/admin";
import { COURSE_LABELS } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const auth = await requireAdmin();
  if (!auth.ok) return { title: "חניך" };
  const { id } = await params;
  const trainee = await adminGetTrainee(auth.grant, id).catch(() => null);
  return { title: trainee ? trainee.fullName : "חניך" };
}

function ItemList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-muted marker:text-line-strong">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default async function AdminTraineeProfilePage({ params }: PageProps) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/");
  const { id } = await params;

  const trainee = await adminGetTrainee(auth.grant, id);
  if (!trainee) notFound();
  const [attachments, owner] = await Promise.all([
    adminListAttachments(auth.grant, id),
    getAdminUser(auth.grant, trainee.ownerId),
  ]);

  const metaParts = [
    owner ? `בעלים: ${owner.username}` : null,
    trainee.courseType ? COURSE_LABELS[trainee.courseType] : null,
    trainee.team ? `צוות ${trainee.team}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={owner ? `/admin/users/${owner.id}` : "/admin/users"}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          {owner ? `חזרה ל${owner.username}` : "חזרה למשתמשים"}
        </Link>
      </div>

      <PageHeader
        title={trainee.fullName}
        description={metaParts.length ? metaParts.join(" · ") : "תיק חניך"}
        actions={
          <Link href={`/admin/trainees/${trainee.id}/edit`} className={buttonClasses({ variant: "secondary" })}>
            עריכה
          </Link>
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

      {/* Admin can view/download/delete, but not upload. */}
      <TraineeAttachments
        traineeId={trainee.id}
        initial={attachments}
        apiBase="/api/admin/trainees"
        canUpload={false}
      />

      <GrantsPanel traineeId={trainee.id} />
    </div>
  );
}
