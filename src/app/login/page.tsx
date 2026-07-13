import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next";

export const metadata = { title: "התחברות" };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(next));

  return (
    <AuthScreen
      title="התחברות"
      subtitle="התחברו עם שם המשתמש והסיסמה שלכם."
      footer={
        <>
          אין לך חשבון?{" "}
          <Link href="/signup" className="font-medium text-white underline underline-offset-2">
            להרשמה
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthScreen>
  );
}
