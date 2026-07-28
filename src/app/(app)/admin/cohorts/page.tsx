import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { CohortsManager } from "@/components/admin/CohortsManager";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminListCohorts, adminListTeams } from "@/lib/data/org-admin";

export const metadata = { title: "מחזורים וצוותים" };
export const dynamic = "force-dynamic";

export default async function AdminCohortsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/login");

  const [cohorts, teams] = await Promise.all([
    adminListCohorts(auth.grant),
    adminListTeams(auth.grant),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="מחזורים וצוותים" description="ניהול מחזורי הקורס והצוותים שבתוכם — יצירה, נעילה וארכיון." />
      <CohortsManager
        initialCohorts={cohorts.map((c) => ({
          id: c.id,
          courseId: c.courseId,
          name: c.name,
          code: c.code,
          status: c.status,
          isLocked: c.isLocked,
          isLegacyDefault: c.isLegacyDefault,
        }))}
        initialTeams={teams.map((t) => ({ id: t.id, cohortId: t.cohortId, name: t.name, isActive: t.isActive }))}
        courses={[]}
        requireCourseSelect={false}
      />
    </div>
  );
}
