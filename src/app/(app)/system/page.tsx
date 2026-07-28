import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Users, FileClock } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui";
import { StatRow } from "@/components/admin/StatRow";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { adminOverview, listAllUsers } from "@/lib/data/admin";
import { listCohorts } from "@/lib/data/cohorts";
import { COURSE_LABELS } from "@/lib/domain/types";

export const metadata = { title: "סקירת מערכת" };
export const dynamic = "force-dynamic";

export default async function SystemHome() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect("/login");

  const [overview, users, cohorts] = await Promise.all([
    adminOverview(auth.grant),
    listAllUsers(auth.grant),
    listCohorts({ includeArchived: true }),
  ]);

  const active = users.filter((u) => u.status === "active").length;
  const suspended = users.filter((u) => u.status === "suspended").length;
  const staff = users.filter((u) => u.role === "staff").length;
  const admins = users.filter((u) => u.role === "admin").length;
  const supers = users.filter((u) => u.role === "super_admin").length;
  const kapeh = users.filter((u) => u.courseType === "kapeh").length;
  const maksim = users.filter((u) => u.courseType === "maksim").length;
  const archivedCohorts = cohorts.filter((c) => c.status === "archived").length;
  const activeCohorts = cohorts.filter((c) => c.status === "active").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="סקירת מערכת" description="ניהול משתמשים, קורסים, מחזורים והרשאות." />

      <StatRow
        stats={[
          { label: "משתמשים", value: users.length },
          { label: "פעילים", value: active },
          { label: "מושהים", value: suspended },
          { label: "סגל", value: staff },
          { label: "מנהלים", value: admins },
          { label: "מנהלי־על", value: supers },
        ]}
      />
      <StatRow
        stats={[
          { label: COURSE_LABELS.kapeh, value: kapeh },
          { label: COURSE_LABELS.maksim, value: maksim },
          { label: "חניכים", value: overview.traineeCount },
          { label: "מסמכים", value: overview.attachmentCount },
          { label: "מחזורים פעילים", value: activeCohorts },
          { label: "מחזורים בארכיון", value: archivedCohorts },
        ]}
      />

      <Panel>
        <ul className="divide-y divide-line">
          {[
            { href: "/system/users", icon: Users, label: "ניהול משתמשים", desc: "סטטוס, שיוך, נראות ותפקידים" },
            { href: "/system/invites", icon: KeyRound, label: "קודי הרשאה", desc: "קודי הרשאת מנהל חד־פעמיים לכל קורס" },
            { href: "/system/audit", icon: FileClock, label: "יומן פעולות", desc: "תיעוד הפעולות הרגישות במערכת" },
          ].map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink transition-colors hover:bg-surface-2">
                <item.icon className="h-5 w-5 text-muted" aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
                <span className="text-muted">— {item.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
