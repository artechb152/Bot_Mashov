import { LandingScreen } from "@/components/landing/LandingScreen";
import { getAccount } from "@/lib/auth/account";
import type { UserRole } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/**
 * The product entry / landing screen (outside the `(app)` shell — public). It shows
 * one primary action whose destination is chosen SERVER-SIDE by role (§37):
 * staff → the bot, admin → the course dashboard, super_admin/root → the system
 * dashboard. Unauthenticated visitors get a login button.
 */
function destinationFor(role: UserRole): string {
  if (role === "super_admin") return "/system";
  if (role === "admin") return "/admin";
  return "/assistant";
}

export default async function HomePage() {
  const account = await getAccount();
  const destination = account ? destinationFor(account.role) : null;
  return <LandingScreen username={account?.username ?? null} destination={destination} />;
}
