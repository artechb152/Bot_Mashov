import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { requireActiveUser } from "@/lib/auth/require-active";
import { normalizeUsername } from "@/lib/auth/username";
import { validateDisplayName, validateUsername } from "@/lib/validation/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH /api/settings/profile — a user updates their OWN display name / username.
// Whitelisted fields only. Username uniqueness is enforced via normalizedUsername.
// Relationships use ObjectIds, so changing the username breaks nothing.
export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const set: Record<string, unknown> = {};

  if (typeof b.displayName === "string") {
    const displayName = b.displayName.trim();
    const err = validateDisplayName(displayName);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    set.displayName = displayName;
    set.fullName = displayName; // keep the legacy field in step with the display name
  }

  let nextUsername: string | null = null;
  if (typeof b.username === "string") {
    const username = b.username.trim();
    const err = validateUsername(username);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    nextUsername = username;
  }

  if (Object.keys(set).length === 0 && nextUsername === null) {
    return NextResponse.json({ error: "לא נשלחו שינויים." }, { status: 400 });
  }

  await connectToDatabase();

  if (nextUsername !== null) {
    const normalized = normalizeUsername(nextUsername);
    const clash = await User.findOne({
      _id: { $ne: auth.grant.userId },
      $or: [{ username: nextUsername }, { normalizedUsername: normalized }],
    })
      .select("_id")
      .lean();
    if (clash) return NextResponse.json({ error: "שם המשתמש כבר תפוס." }, { status: 409 });
    set.username = nextUsername;
    set.normalizedUsername = normalized;
  }

  try {
    await User.updateOne({ _id: auth.grant.userId }, { $set: set });
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "שם המשתמש כבר תפוס." }, { status: 409 });
    }
    console.error("[api/settings/profile] failed:", err);
    return NextResponse.json({ error: "עדכון הפרופיל נכשל." }, { status: 500 });
  }

  const fresh = await User.findById(auth.grant.userId).select("displayName username").lean<{ displayName?: string; username?: string } | null>();
  return NextResponse.json({
    profile: { displayName: fresh?.displayName ?? "", username: fresh?.username ?? "" },
  });
}
