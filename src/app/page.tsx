import { LandingScreen } from "@/components/landing/LandingScreen";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

/**
 * The root is the product's entry / landing screen. It renders OUTSIDE the
 * `(app)` route group, so it does not get the sidebar/topbar app shell. It stays
 * public, and shows a login button or the user menu depending on auth state.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  return <LandingScreen user={user} />;
}
