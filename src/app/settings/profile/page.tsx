import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { getAccount } from "@/lib/auth/account";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { SecuritySettingsForm } from "@/components/settings/SecuritySettingsForm";

export const dynamic = "force-dynamic";

/**
 * The single profile page: account details + display name/username, and password
 * change — one source of truth (§1/§12). No navigation shortcuts here.
 */
export default async function ProfileSettingsPage() {
  const account = await getAccount();
  if (!account) redirect("/");

  await connectToDatabase();
  const user = await User.findById(account.id)
    .select("displayName username")
    .lean<{ displayName?: string; username?: string } | null>();

  return (
    <div className="space-y-8">
      <section>
        <ProfileSettingsForm
          initialDisplayName={user?.displayName ?? account.username}
          initialUsername={user?.username ?? account.username}
        />
      </section>
      <section className="border-t border-line pt-6">
        <h2 className="mb-4 text-lg font-semibold text-ink">שינוי סיסמה</h2>
        <SecuritySettingsForm />
      </section>
    </div>
  );
}
