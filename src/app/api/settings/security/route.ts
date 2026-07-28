import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { requireActiveUser } from "@/lib/auth/require-active";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validatePassword } from "@/lib/validation/auth";
import { writeAudit } from "@/lib/data/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// PATCH /api/settings/security — a user changes their OWN password. Requires the
// current password. Never returns or logs any hash; never stores the plaintext.
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
  const currentPassword = typeof b.currentPassword === "string" ? b.currentPassword : "";
  const newPassword = typeof b.newPassword === "string" ? b.newPassword : "";
  const confirmPassword = typeof b.confirmPassword === "string" ? b.confirmPassword : "";

  if (!currentPassword) {
    return NextResponse.json({ error: "יש להזין את הסיסמה הנוכחית." }, { status: 400 });
  }
  const pwErr = validatePassword(newPassword, confirmPassword);
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 });

  await connectToDatabase();
  const user = await User.findById(auth.grant.userId).select("_id passwordHash").lean<{ _id: unknown; passwordHash?: string } | null>();
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: "אירעה שגיאה. נסו שוב." }, { status: 400 });
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "הסיסמה הנוכחית שגויה." }, { status: 403 });
  }

  const passwordHash = await hashPassword(newPassword);
  await User.updateOne({ _id: auth.grant.userId }, { $set: { passwordHash } });
  await writeAudit({
    actorId: auth.grant.userId,
    action: "user.password_changed",
    targetType: "user",
    targetId: auth.grant.userId,
  });

  return NextResponse.json({ ok: true });
}
