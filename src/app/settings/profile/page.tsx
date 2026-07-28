import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { getAccount } from "@/lib/auth/account";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const account = await getAccount();
  if (!account) redirect("/login");

  await connectToDatabase();
  const user = await User.findById(account.id)
    .select("displayName username")
    .lean<{ displayName?: string; username?: string } | null>();

  return (
    <ProfileSettingsForm
      initialDisplayName={user?.displayName ?? account.username}
      initialUsername={user?.username ?? account.username}
    />
  );
}
