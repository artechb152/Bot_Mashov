import { redirect } from "next/navigation";
import { PageHeader, Panel, Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { listAuditLogs } from "@/lib/data/audit";

export const metadata = { title: "יומן פעולות" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "user.role_changed": "שינוי תפקיד",
  "user.status_changed": "שינוי סטטוס",
  "user.visibility_changed": "שינוי נראות",
  "user.password_changed": "שינוי סיסמה",
  "trainee.owner_changed": "העברת בעלות על חניך",
  "cohort.created": "יצירת מחזור",
  "cohort.edited": "עריכת מחזור",
  "cohort.archived": "העברת מחזור לארכיון",
  "cohort.restored": "החזרת מחזור לפעיל",
  "cohort.locked": "נעילת מחזור",
  "cohort.unlocked": "ביטול נעילת מחזור",
  "team.created": "יצירת צוות",
  "team.edited": "עריכת צוות",
  "team.enabled": "הפעלת צוות",
  "team.disabled": "השבתת צוות",
  "assignment.changed": "שינוי שיוך",
  "invite.created": "יצירת קוד הרשאה",
  "invite.revoked": "ביטול קוד הרשאה",
  "invite.used": "ניצול קוד הרשאה",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default async function SystemAuditPage() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect("/login");
  const logs = await listAuditLogs({ limit: 200 });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="יומן פעולות" description="תיעוד הפעולות הרגישות במערכת — מי ביצע, מה ומתי." />
      <Panel className="p-0">
        {logs.length === 0 ? (
          <EmptyState title="היומן ריק" description="עדיין לא תועדו פעולות." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>מבצע</TH>
                <TH>פעולה</TH>
                <TH>יעד</TH>
                <TH>סיבה</TH>
                <TH>מתי</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((l) => (
                <TR key={l.id}>
                  <TD className="font-medium">{l.actorName}</TD>
                  <TD className="text-muted">{ACTION_LABELS[l.action] ?? l.action}</TD>
                  <TD className="text-muted">{l.targetType}</TD>
                  <TD className="text-muted">{l.reason ?? "—"}</TD>
                  <TD className="text-muted tabular-nums">{formatDate(l.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
