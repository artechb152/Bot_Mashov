import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot } from "lucide-react";
import { buttonClasses, PageHeader, Panel } from "@/components/ui";
import { SmartBackButton } from "@/components/layout/SmartBackButton";
import { DeleteTraineeButton } from "@/components/trainees/DeleteTraineeButton";
import { TraineeAttachments } from "@/components/trainees/TraineeAttachments";
import { readTraineeById } from "@/lib/data/trainees";
import { readAttachmentsById } from "@/lib/data/attachments";
import { requireTraineeAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const access = await requireTraineeAccess(id).catch(() => null);
  if (!access || !access.ok) return { title: "חניך" };
  const trainee = await readTraineeById(id).catch(() => null);
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
  const { id } = await params;
  // Unified gate: owner, active view/edit grant, course admin, or super-admin. A
  // non-authorized id 404s (indistinguishable from missing). Access LEVEL is derived
  // SERVER-SIDE (owner | view | edit | course_admin | super_admin) — never trusted
  // from the client — and drives which controls are shown.
  const access = await requireTraineeAccess(id);
  if (!access.ok) notFound();
  const level = access.via;
  const isOwner = level === "owner";
  // Who may open the edit form: anyone but a pure view-grant holder.
  const canEdit = level !== "view";
  // Document management (upload / delete) on the staff page stays OWNER-only. Edit
  // grants can edit trainee fields but do NOT gain document upload/delete here (the
  // staff document routes are owner-scoped); admins manage documents on /admin pages.
  const canManageDocs = isOwner;
  const trainee = await readTraineeById(id);
  if (!trainee) notFound();
  const attachments = await readAttachmentsById(trainee.id);

  const meta = trainee.team ? `צוות ${trainee.team}` : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <SmartBackButton fallbackHref="/trainees" label="חזרה לרשימת החניכים" />
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
            {canEdit ? (
              <Link href={`/trainees/${trainee.id}/edit`} className={buttonClasses({ variant: "secondary" })}>
                עריכה
              </Link>
            ) : null}
            {isOwner ? <DeleteTraineeButton id={trainee.id} name={trainee.fullName} /> : null}
            {level === "view" ? <span className="text-xs text-muted">גישת צפייה</span> : null}
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

      <TraineeAttachments traineeId={trainee.id} initial={attachments} canUpload={canManageDocs} canDelete={canManageDocs} />
    </div>
  );
}
