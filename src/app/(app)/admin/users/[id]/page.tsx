import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, ChevronLeft, Mail, MessageSquare } from "lucide-react";
import { buttonClasses, EmptyState, PageHeader, Panel, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { RoleControl } from "@/components/admin/RoleControl";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAccount } from "@/lib/auth/account";
import { getAdminUser, listTraineesForUser } from "@/lib/data/admin";
import { canMessageUser } from "@/lib/data/recipients";
import { COURSE_LABELS, USER_ROLE_LABELS } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const auth = await requireAdmin();
  if (!auth.ok) return { title: "משתמש" };
  const { id } = await params;
  const user = await getAdminUser(auth.grant, id).catch(() => null);
  return { title: user ? user.username : "משתמש" };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/");
  const account = await getAccount();
  const { id } = await params;

  const user = await getAdminUser(auth.grant, id);
  if (!user) notFound();
  const trainees = await listTraineesForUser(auth.grant, id);
  const isSelf = account?.id === user.id;
  // Offer "send message" only if the viewer is actually permitted to message this
  // user (same messaging permission rules as compose/recipient search).
  const canMessage = account ? await canMessageUser(account, user.id) : false;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/admin/users" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה לרשימת המשתמשים
        </Link>
      </div>

      <PageHeader
        title={user.username}
        description={user.fullName && user.fullName !== user.username ? user.fullName : "פרטי משתמש"}
        actions={
          canMessage ? (
            <Link href={`/messages/compose?to=${user.id}`} className={buttonClasses({ size: "sm" })}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span className="ms-1">שליחת הודעה</span>
            </Link>
          ) : undefined
        }
      />

      {/* Details */}
      <Panel>
        <h3 className="text-sm font-semibold text-ink">פרטי המשתמש</h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted">שם משתמש:</dt>
            <dd className="text-ink">{user.username}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">קורס:</dt>
            <dd className="text-ink">{user.courseType ? COURSE_LABELS[user.courseType] : "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">תפקיד:</dt>
            <dd className="text-ink">{USER_ROLE_LABELS[user.role]}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">נוצר:</dt>
            <dd className="text-ink tabular-nums">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </Panel>

      {/* Role management */}
      <Panel>
        <h3 className="text-sm font-semibold text-ink">הרשאה</h3>
        <div className="mt-3">
          <RoleControl userId={user.id} initialRole={user.role} isSelf={isSelf} />
        </div>
      </Panel>

      {/* Their trainees */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">
          חניכים <span className="text-sm font-normal text-muted">({trainees.length})</span>
        </h3>
        {trainees.length === 0 ? (
          <EmptyState title="אין חניכים" description="למשתמש זה אין עדיין חניכים." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>שם</TH>
                <TH>צוות</TH>
                <TH>חוזקות</TH>
                <TH>חולשות</TH>
                <TH>
                  <span className="sr-only">פעולות</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {trainees.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium">
                    <Link href={`/admin/trainees/${t.id}`} className="hover:underline">
                      {t.fullName}
                    </Link>
                  </TD>
                  <TD className="text-muted">{t.team || "—"}</TD>
                  <TD className="text-muted tabular-nums">{t.strengths.length}</TD>
                  <TD className="text-muted tabular-nums">{t.weaknesses.length}</TD>
                  <TD className="text-end">
                    <Link
                      href={`/admin/trainees/${t.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline"
                    >
                      פרופיל
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      {/* Bot conversations — placeholder for a later phase */}
      <Panel>
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-subtle" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-ink">שיחות בוט</h3>
            <p className="mt-1 text-sm text-muted">יתווסף בשלב הבא</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
