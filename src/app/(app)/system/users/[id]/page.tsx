import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Mail } from "lucide-react";
import { buttonClasses } from "@/components/ui";
import { UserManagementPanel } from "@/components/system/UserManagementPanel";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { getAdminUser } from "@/lib/data/admin";
import { canMessageUser } from "@/lib/data/recipients";
import { getAccount } from "@/lib/auth/account";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function SystemUserPage({ params }: PageProps) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) redirect("/");
  const { id } = await params;

  const [account, user] = await Promise.all([getAccount(), getAdminUser(auth.grant, id)]);
  if (!user) notFound();
  const canMessage = account ? await canMessageUser(account, user.id) : false;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/system/users" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          לכל המשתמשים
        </Link>
        {canMessage ? (
          <Link href={`/messages/compose?to=${user.id}`} className={buttonClasses({ size: "sm" })}>
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span className="ms-1">שליחת הודעה</span>
          </Link>
        ) : null}
      </div>
      <UserManagementPanel
        user={{
          id: user.id,
          displayName: user.displayName,
          username: user.username,
          role: user.role,
          isRootSuperAdmin: user.isRootSuperAdmin,
          status: user.status,
          adminPosition: user.adminPosition,
          directoryVisibility: user.directoryVisibility,
          courseType: user.courseType,
          traineeCount: user.traineeCount,
        }}
        viewerIsRoot={account?.isRootSuperAdmin === true}
      />
    </div>
  );
}
