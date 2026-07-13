import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { parseSignup } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = parseSignup(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
  }
  const { username, password } = parsed.data;

  try {
    await connectToDatabase();

    const existing = await User.findOne({ username }).select("_id").lean();
    if (existing) {
      return NextResponse.json({ error: "שם המשתמש כבר תפוס." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      username,
      passwordHash,
      fullName: username,
      role: "commander",
    });

    const token = await signSession({ id: String(user._id), username: user.username });
    const res = NextResponse.json(
      { user: { id: String(user._id), username: user.username } },
      { status: 201 },
    );
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    console.log(`[api/auth/signup] created user ${String(user._id)} → 201`);
    return res;
  } catch (err) {
    // Unique-index race → duplicate username.
    if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "שם המשתמש כבר תפוס." }, { status: 409 });
    }
    console.error("[api/auth/signup] failed:", err);
    return NextResponse.json({ error: "ההרשמה נכשלה. נסו שוב." }, { status: 500 });
  }
}
