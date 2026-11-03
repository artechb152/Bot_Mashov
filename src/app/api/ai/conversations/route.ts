import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireTraineeAccess } from "@/lib/auth/access";
import { createConversation, listConversations } from "@/lib/data/conversations";
import type { CourseType } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * AI conversations for a trainee. Both operations require live VIEW access to the
 * trainee (`requireTraineeAccess`); listing is scoped to the caller's OWN
 * conversations. An unauthorized trainee id → 404.
 */

// GET /api/ai/conversations?traineeId=… — the caller's conversations for a trainee.
export async function GET(request: Request) {
  const traineeId = new URL(request.url).searchParams.get("traineeId") ?? "";
  if (!isValidObjectId(traineeId)) return NextResponse.json({ error: "מזהה חניך חסר או שגוי." }, { status: 400 });

  const access = await requireTraineeAccess(traineeId);
  if (!access.ok) return access.response;

  try {
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
    const conversations = await listConversations(traineeId, access.actorId, { includeArchived });
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("[api/ai/conversations] GET failed:", error);
    return NextResponse.json({ error: "טעינת השיחות נכשלה." }, { status: 500 });
  }
}

// POST /api/ai/conversations — create a conversation (default sources = all active feedback).
export async function POST(request: Request) {
  let body: { traineeId?: string; title?: string };
  try {
    body = (await request.json()) as { traineeId?: string; title?: string };
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const traineeId = body.traineeId ?? "";
  if (!isValidObjectId(traineeId)) return NextResponse.json({ error: "מזהה חניך חסר או שגוי." }, { status: 400 });

  const access = await requireTraineeAccess(traineeId);
  if (!access.ok) return access.response;

  try {
    const conversation = await createConversation(
      traineeId,
      {
        ownerId: access.actorId,
        courseType: access.trainee.courseType as CourseType | null,
        courseId: access.trainee.courseId,
      },
      { title: typeof body.title === "string" ? body.title : undefined },
    );
    if (!conversation) return NextResponse.json({ error: "יצירת השיחה נכשלה." }, { status: 500 });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("[api/ai/conversations] POST failed:", error);
    return NextResponse.json({ error: "יצירת השיחה נכשלה." }, { status: 500 });
  }
}
