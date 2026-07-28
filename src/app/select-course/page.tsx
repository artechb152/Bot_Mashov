import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SelectCourseForm } from "@/components/course/SelectCourseForm";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "בחירת קורס" };
export const dynamic = "force-dynamic";

/**
 * One-time course selection, shown only to a signed-in user whose account has no
 * course yet (i.e. it was created before course modes existed). New users choose
 * at signup and never land here.
 *
 * Deliberately OUTSIDE the "(app)" route group: that layout redirects course-less
 * users here, so rendering inside it would loop.
 */
export default async function SelectCoursePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Already has a course — nothing to choose.
  if (user.courseType) redirect("/");

  return (
    <AuthScreen
      title="בחירת קורס"
      subtitle="כדי להמשיך, בחרו את הקורס שאליו אתם משתייכים. הבחירה נשמרת פעם אחת."
      footer="החניכים הקיימים שלכם יעודכנו לקורס שתבחרו."
    >
      <SelectCourseForm />
    </AuthScreen>
  );
}
