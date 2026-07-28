import { redirect } from "next/navigation";
import { PageHeader, Panel, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { listCourses } from "@/lib/data/courses";
import { listAllUsers, listAllTrainees } from "@/lib/data/admin";

export const metadata = { title: "קורסים" };
export const dynamic = "force-dynamic";

export default async function SystemCoursesPage() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect("/login");

  const [courses, users, trainees] = await Promise.all([
    listCourses(),
    listAllUsers(auth.grant),
    listAllTrainees(auth.grant),
  ]);

  const rows = courses.map((c) => ({
    ...c,
    userCount: users.filter((u) => u.courseType === c.code).length,
    traineeCount: trainees.filter((t) => t.courseType === c.code).length,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="קורסים" description="הקורסים שהמערכת משרתת." />
      <Panel className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>קורס</TH>
              <TH>סטטוס</TH>
              <TH>משתמשים</TH>
              <TH>חניכים</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.name}</TD>
                <TD className="text-muted">{c.isActive ? "פעיל" : "לא פעיל"}</TD>
                <TD className="text-muted tabular-nums">{c.userCount}</TD>
                <TD className="text-muted tabular-nums">{c.traineeCount}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Panel>
    </div>
  );
}
