import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Team, User, UserAssignment } from "@/models";
import { parseStaffSignup, parseAdminSignup } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/auth/username";
import { courseIdForType, courseTypeForId } from "@/lib/data/courses";
import { ensureCurrentAssignment } from "@/lib/data/assignments";
import { validateInvite, consumeInvite } from "@/lib/data/invites";
import { signSession, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/auth/session";
import type { CourseType } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DUPLICATE = "שם המשתמש כבר תפוס.";

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: number }).code === 11000);
}

async function usernameTaken(username: string): Promise<boolean> {
  const normalized = normalizeUsername(username);
  const existing = await User.findOne({
    $or: [{ username }, { normalizedUsername: normalized }],
  })
    .select("_id")
    .lean();
  return Boolean(existing);
}

function sessionResponse(user: { _id: unknown; username: string }, courseType: CourseType | null) {
  return signSession({ id: String(user._id), username: user.username, courseType }).then((token) => {
    const res = NextResponse.json(
      { user: { id: String(user._id), username: user.username, courseType } },
      { status: 201 },
    );
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
    return res;
  });
}

/* -------------------------------------------------------------------------- */
/* Staff signup                                                                */
/* -------------------------------------------------------------------------- */

async function staffSignup(body: Record<string, unknown>): Promise<NextResponse> {
  const parsed = parseStaffSignup(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
  }
  const { displayName, username, password, courseType, cohortId, teamId } = parsed.data;

  await connectToDatabase();

  const courseId = await courseIdForType(courseType);
  if (!courseId) {
    return NextResponse.json({ error: "הקורס שנבחר אינו זמין. פנה למנהל המערכת." }, { status: 400 });
  }
  // The cohort must belong to the chosen course and be selectable (active).
  const cohort = await Cohort.findOne({ _id: cohortId, courseId, status: "active" }).select("_id").lean();
  if (!cohort) {
    return NextResponse.json({ error: "המחזור שנבחר אינו תקין." }, { status: 400 });
  }
  // The team must belong to the chosen cohort and be active.
  const team = await Team.findOne({ _id: teamId, cohortId, isActive: { $ne: false } }).select("_id").lean();
  if (!team) {
    return NextResponse.json({ error: "הצוות שנבחר אינו תקין." }, { status: 400 });
  }

  if (await usernameTaken(username)) {
    return NextResponse.json({ error: DUPLICATE }, { status: 409 });
  }

  let user: { _id: unknown; username: string } | null = null;
  try {
    const passwordHash = await hashPassword(password);
    const created = await User.create({
      username,
      normalizedUsername: normalizeUsername(username),
      displayName,
      fullName: displayName,
      passwordHash,
      role: "staff",
      status: "active",
      courseType,
      courseId: new Types.ObjectId(courseId),
      onboardingStatus: "complete",
    });
    user = { _id: created._id, username: created.username };

    // Assignment failure must not leave a half-created account.
    try {
      await ensureCurrentAssignment(String(created._id), String(created._id), {
        courseId,
        cohortId,
        teamId,
        assignmentType: "staff_team",
        role: "staff",
      });
    } catch (assignErr) {
      await User.deleteOne({ _id: created._id });
      console.error("[api/auth/signup] staff assignment failed, rolled back user:", assignErr);
      return NextResponse.json({ error: "ההרשמה נכשלה. נסו שוב." }, { status: 500 });
    }

    return await sessionResponse(user, courseType);
  } catch (err) {
    if (isDuplicateKeyError(err)) return NextResponse.json({ error: DUPLICATE }, { status: 409 });
    console.error("[api/auth/signup] staff failed:", err);
    return NextResponse.json({ error: "ההרשמה נכשלה. נסו שוב." }, { status: 500 });
  }
}

/* -------------------------------------------------------------------------- */
/* Admin signup (temporary invite code)                                        */
/* -------------------------------------------------------------------------- */

function inviteErrorMessage(reason: string): string {
  switch (reason) {
    case "expired":
      return "קוד ההרשאה פג תוקף";
    case "used":
      return "קוד ההרשאה כבר נוצל";
    case "revoked":
      return "קוד ההרשאה בוטל";
    case "invalid_position":
      return "קוד ההרשאה אינו מתאים לתפקיד שנבחר";
    default:
      return "קוד ההרשאה אינו תקין";
  }
}

async function adminSignup(body: Record<string, unknown>): Promise<NextResponse> {
  const parsed = parseAdminSignup(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
  }
  const { displayName, username, password, inviteCode, adminPosition } = parsed.data;

  await connectToDatabase();

  // Pre-validate (non-consuming) to resolve the invite's course + allowed positions.
  const check = await validateInvite(inviteCode);
  if (!check.ok) {
    return NextResponse.json({ error: inviteErrorMessage(check.reason) }, { status: 403 });
  }
  if (check.allowedAdminPositions.length > 0 && !check.allowedAdminPositions.includes(adminPosition)) {
    return NextResponse.json({ error: "קוד ההרשאה אינו מתאים לתפקיד שנבחר" }, { status: 403 });
  }
  const courseType = await courseTypeForId(check.courseId);
  if (!courseType) {
    return NextResponse.json({ error: "קוד ההרשאה אינו מתאים לקורס שנבחר" }, { status: 403 });
  }

  if (await usernameTaken(username)) {
    return NextResponse.json({ error: DUPLICATE }, { status: 409 });
  }

  let createdId: unknown = null;
  let assignmentId: string | null = null;
  try {
    const passwordHash = await hashPassword(password);
    const created = await User.create({
      username,
      normalizedUsername: normalizeUsername(username),
      displayName,
      fullName: displayName,
      passwordHash,
      role: "admin",
      adminPosition,
      status: "active",
      courseType,
      courseId: new Types.ObjectId(check.courseId),
      onboardingStatus: "complete",
    });
    createdId = created._id;

    assignmentId = await ensureCurrentAssignment(String(created._id), String(created._id), {
      courseId: check.courseId,
      assignmentType: "course_admin",
      role: "admin",
      adminPosition,
    });

    // Consume the invite LAST (atomic single-use). If it fails — someone else took
    // it, or it expired/was revoked meanwhile — roll back the user + assignment so
    // the invite is never permanently consumed by a failed signup.
    const consumed = await consumeInvite(inviteCode, String(created._id), adminPosition);
    if (!consumed.ok) {
      if (assignmentId) await UserAssignment.deleteOne({ _id: assignmentId });
      await User.deleteOne({ _id: created._id });
      return NextResponse.json({ error: inviteErrorMessage(consumed.reason) }, { status: 403 });
    }

    return await sessionResponse({ _id: created._id, username: created.username }, courseType);
  } catch (err) {
    // Best-effort cleanup on any failure after user creation.
    if (assignmentId) await UserAssignment.deleteOne({ _id: assignmentId }).catch(() => {});
    if (createdId) await User.deleteOne({ _id: createdId }).catch(() => {});
    if (isDuplicateKeyError(err)) return NextResponse.json({ error: DUPLICATE }, { status: 409 });
    console.error("[api/auth/signup] admin failed:", err);
    return NextResponse.json({ error: "ההרשמה נכשלה. נסו שוב." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const b = (body ?? {}) as Record<string, unknown>;
  // The presence of an invite code selects the admin path. `role` is never read
  // from the body on either path — it is assigned by the server.
  const hasInvite = typeof b.inviteCode === "string" && b.inviteCode.trim().length > 0;
  return hasInvite ? adminSignup(b) : staffSignup(b);
}
