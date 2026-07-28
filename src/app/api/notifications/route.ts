import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { listNotifications, unreadCount } from "@/lib/data/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/notifications — the current user's notifications + unread count.
// ?count=1 returns only the unread count (used by the header badge poll).
export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;

  const countOnly = new URL(request.url).searchParams.get("count") === "1";
  if (countOnly) {
    return NextResponse.json({ unread: await unreadCount(auth.grant.userId) });
  }
  const [notifications, unread] = await Promise.all([
    listNotifications(auth.grant.userId),
    unreadCount(auth.grant.userId),
  ]);
  return NextResponse.json({ notifications, unread });
}
