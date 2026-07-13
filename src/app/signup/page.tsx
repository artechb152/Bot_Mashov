import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SignupForm } from "@/components/auth/SignupForm";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata = { title: "הרשמה" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <AuthScreen
      title="הרשמה"
      subtitle="יצירת חשבון סגל חדש."
      footer={
        <>
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="font-medium text-white underline underline-offset-2">
            להתחברות
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthScreen>
  );
}
