import { PageHeader } from "@/components/ui";
import { InvitesManager } from "@/components/system/InvitesManager";
import { listInvites } from "@/lib/data/invites";
import { listCourses } from "@/lib/data/courses";

export const dynamic = "force-dynamic";

/**
 * Super-admin invite management. The layout already gated super_admin; the data
 * functions here read only non-sensitive invite metadata (never the code/hash).
 */
export default async function SystemInvitesPage() {
  const [invites, courses] = await Promise.all([listInvites(), listCourses()]);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="קודי גישה"
        description="קודי גישה חד־פעמיים ליצירת חשבון מנהל חדש, לכל קורס, עם תפוגה. הקוד מוצג פעם אחת בלבד בעת היצירה."
      />
      <InvitesManager
        initialInvites={invites}
        courses={courses.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
