import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { buttonClasses, PageHeader, Panel, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { StatRow } from "@/components/admin/StatRow";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminOverview, listAllUsers } from "@/lib/data/admin";
import { COURSE_LABELS, USER_ROLE_LABELS } from "@/lib/domain/types";
import { getAccount } from "@/lib/auth/account";

export const metadata = { title: "לוח בקרה" };
export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminDashboardPage() {
  // The layout already gated this, but re-deriving the grant here keeps the data
  // call honest (the data layer accepts only an AdminGrant).
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/login");

  const [account, overview, users] = await Promise.all([
    getAccount(),
    adminOverview(auth.grant),
    listAllUsers(auth.grant),
  ]);
  const recent = users.slice(0, 6);
  const courseLabel = account?.courseType ? COURSE_LABELS[account.courseType] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="סקירת קורס"
        description={courseLabel ? `ניהול הסגל, החניכים והמחזורים בקורס ${courseLabel}.` : "ניהול הסגל, החניכים והמחזורים."}
      />

      <StatRow
        stats={[
          { label: "אנשי סגל", value: overview.staffCount },
          { label: "חניכים", value: overview.traineeCount },
          { label: "מסמכים", value: overview.attachmentCount },
          { label: "מחזורים פעילים", value: overview.cohortsActive },
          { label: "מחזורים בארכיון", value: overview.cohortsArchived },
          { label: "צוותים", value: overview.teamCount },
        ]}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">אנשי סגל</h2>
          <Link href="/admin/users" className="text-sm font-medium text-ink hover:underline">
            לכל אנשי הסגל
          </Link>
        </div>

        {recent.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted">אין עדיין משתמשים במערכת.</p>
          </Panel>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>שם משתמש</TH>
                <TH>קורס</TH>
                <TH>תפקיד</TH>
                <TH>חניכים</TH>
                <TH>נוצר</TH>
                <TH>
                  <span className="sr-only">פעולות</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {recent.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">
                    <Link href={`/admin/users/${u.id}`} className="hover:underline">
                      {u.username}
                    </Link>
                  </TD>
                  <TD className="text-muted">{u.courseType ? COURSE_LABELS[u.courseType] : "—"}</TD>
                  <TD className="text-muted">{USER_ROLE_LABELS[u.role]}</TD>
                  <TD className="text-muted tabular-nums">{u.traineeCount}</TD>
                  <TD className="text-muted tabular-nums">{formatDate(u.createdAt)}</TD>
                  <TD className="text-end">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline"
                    >
                      פרטים
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-muted">
        <Link href="/admin/users" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          ניהול משתמשים
        </Link>
      </p>
    </div>
  );
}
