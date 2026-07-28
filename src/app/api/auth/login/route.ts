import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { parseLogin } from "@/lib/validation/auth";
import { isCourseType, isUserStatus } from "@/lib/domain/types";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LeanUser = {
  _id: unknown;
  username: string;
  passwordHash: string;
  courseType?: string | null;
  status?: string | null;
};

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
      .select("_id username passwordHash courseType status")
      .lean<LeanUser | null>();

    // Same message AND same work for "no such user" and "wrong password" (no user
    // enumeration by response body or by timing).
    const ok = await verifyPasswordOrDummy(password, user?.passwordHash ?? null);
    if (!user || !ok) {
      return NextResponse.json({ error: "שם משתמש או סיסמה שגויים." }, { status: 401 });
    }

    // Only AFTER the password is verified do we reveal account-status detail (never
    // to an unauthenticated attacker). A missing status is a legacy row → active.
    const status = isUserStatus(user.status) ? user.status : "active";
    if (status !== "active") {
      const error =
        status === "suspended"
          ? "החשבון מושהה זמנית. יש לפנות למנהל המערכת."
          : "החשבון מושבת. יש לפנות למנהל המערכת.";
      return NextResponse.json({ error }, { status: 403 });
    }

    // Legacy users predate course selection and have none stored — they get a
    // course-less session and are routed once through /select-course.
    const courseType = isCourseType(user.courseType) ? user.courseType : null;

    const token = await signSession({
      id: String(user._id),
      username: user.username,
      courseType,
    });
    const res = NextResponse.json({
      user: { id: String(user._id), username: user.username, courseType },
    });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    // Record last login (best-effort; never blocks the response on failure).
    void User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch((e) =>
      console.error("[api/auth/login] lastLoginAt update failed:", e),
    );
    console.log(`[api/auth/login] user ${String(user._id)} → 200`);
    return res;
  } catch (err) {
    console.error("[api/auth/login] failed:", err);
    return NextResponse.json({ error: "ההתחברות נכשלה. נסו שוב." }, { status: 500 });
  }
}
