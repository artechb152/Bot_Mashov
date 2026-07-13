import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { parseLogin } from "@/lib/validation/auth";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LeanUser = { _id: unknown; username: string; passwordHash: string };

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = parseLogin(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
  }
  const { username, password } = parsed.data;

  try {
    await connectToDatabase();
    const user = await User.findOne({ username })
      .select("_id username passwordHash")
      .lean<LeanUser | null>();

    // Same message AND same work for "no such user" and "wrong password" (no user
    // enumeration by response body or by timing).
    const ok = await verifyPasswordOrDummy(password, user?.passwordHash ?? null);
    if (!user || !ok) {
      return NextResponse.json({ error: "שם משתמש או סיסמה שגויים." }, { status: 401 });
    }

    const token = await signSession({ id: String(user._id), username: user.username });
    const res = NextResponse.json({ user: { id: String(user._id), username: user.username } });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    console.log(`[api/auth/login] user ${String(user._id)} → 200`);
    return res;
  } catch (err) {
    console.error("[api/auth/login] failed:", err);
    return NextResponse.json({ error: "ההתחברות נכשלה. נסו שוב." }, { status: 500 });
  }
}
