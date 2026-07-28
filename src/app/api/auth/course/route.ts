import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Trainee, User } from "@/models";
import { parseCourseChoice } from "@/lib/validation/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isCourseType, type CourseType } from "@/lib/domain/types";
import { signSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/course — the one-time course choice for a user who has none.
 *
 * This doubles as the migration for records that predate course modes. It is
 * written to be SAFE ON A STANDALONE MONGODB: no transactions are available, so
 * the writes are sequential, additive, idempotent, and safe to retry.
 *
 * Order matters, and it is the whole safety argument:
 *
 *   1. resolve a STICKY course — once anything has been stamped, that value wins
 *      over whatever the form submitted, so a retry can never diverge to a
 *      different course than a previous partial run already wrote.
 *   2. backfill the user's un-coursed trainees (never overwriting a set value).
 *   3. ONLY THEN stamp the user.
 *   4. ONLY THEN re-sign the session cookie.
 *
 * Because the user is stamped strictly after their trainees, the invariant
 * "a user with a course has trainees that all carry that course" always holds.
 * If it were done the other way round, a crash in between would leave a user who
 * logs in with a course but whose trainees are invisible behind the course
 * filter — i.e. their trainees would appear to vanish. Nothing is ever deleted.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });

  // Already chosen (e.g. a double-submit, or a stale tab) — nothing to do.
  if (user.courseType) {
    return NextResponse.json({ courseType: user.courseType });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseCourseChoice(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
  }

  try {
    await connectToDatabase();

    // (1) Sticky course. A course is immutable once chosen, so anything already
    // written — on the user, or on a trainee from an earlier partial run — wins.
    const existingUser = await User.findById(user.id).select("_id courseType").lean<{
      _id: unknown;
      courseType?: string | null;
    } | null>();
    if (!existingUser) {
      return NextResponse.json({ error: "המשתמש לא נמצא." }, { status: 404 });
    }

    let sticky: CourseType | null = isCourseType(existingUser.courseType)
      ? existingUser.courseType
      : null;

    if (!sticky) {
      const stamped = await Trainee.findOne({
        commanderId: user.id,
        courseType: { $nin: [null, undefined] },
      })
        .select("courseType")
        .lean<{ courseType?: string | null } | null>();
      if (stamped && isCourseType(stamped.courseType)) sticky = stamped.courseType;
    }

    const courseType: CourseType = sticky ?? parsed.data.courseType;

    // (2) Backfill this user's trainees that have no course yet. Additive only:
    // the filter guarantees an already-set courseType is never overwritten.
    const backfill = await Trainee.updateMany(
      {
        commanderId: user.id,
        $or: [{ courseType: { $exists: false } }, { courseType: null }],
      },
      { $set: { courseType } },
    );

    // (3) Only now stamp the user (see the ordering argument above).
    await User.updateOne({ _id: user.id }, { $set: { courseType } });

    // (4) Only now re-sign the session so the app sees the course.
    const token = await signSession({ id: user.id, username: user.username, courseType });
    const res = NextResponse.json({ courseType, traineesBackfilled: backfill.modifiedCount });
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    console.log(
      `[api/auth/course] user ${user.id} → ${courseType} (trainees backfilled: ${backfill.modifiedCount})`,
    );
    return res;
  } catch (err) {
    console.error("[api/auth/course] failed:", err);
    return NextResponse.json(
      { error: "שמירת הקורס נכשלה. נסו שוב." },
      { status: 500 },
    );
  }
}
