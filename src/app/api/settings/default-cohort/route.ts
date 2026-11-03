import { NextResponse } from "next/server";
import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { getAccount } from "@/lib/auth/account";
import { getCohort } from "@/lib/data/cohorts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PATCH /api/settings/default-cohort — persist the caller's personal default cohort
 * (the one /workspace opens on). NOT an authz change: the cohort must simply be one
 * the caller may navigate (same course, or any for super_admin) and not archived.
 * An unauthorized/unknown cohort returns a generic 404.
 */
export async function PATCH(request: Request) {
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  if (account.status !== "active") return NextResponse.json({ error: "החשבון אינו פעיל." }, { status: 403 });

  let body: { cohortId?: unknown };
  try {
    body = (await request.json()) as { cohortId?: unknown };
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const cohortId = typeof body.cohortId === "string" ? body.cohortId : "";
  if (!isValidObjectId(cohortId)) return NextResponse.json({ error: "מזהה מחזור שגוי." }, { status: 400 });

  const cohort = await getCohort(cohortId);
  const notFound = () => NextResponse.json({ error: "המחזור לא נמצא." }, { status: 404 });
  if (!cohort || cohort.status === "archived") return notFound();
  // Non-global users may only default to a cohort in their own course.
  if (account.role !== "super_admin" && (!account.courseType || cohort.courseType !== account.courseType)) {
    return notFound();
  }

  try {
    await connectToDatabase();
    await User.updateOne({ _id: account.id }, { $set: { defaultCohortId: new Types.ObjectId(cohortId) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/settings/default-cohort] PATCH failed:", error);
    return NextResponse.json({ error: "שמירת ברירת המחדל נכשלה." }, { status: 500 });
  }
}
