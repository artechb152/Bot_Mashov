import { NextResponse } from "next/server";
import { validateInvite } from "@/lib/data/invites";
import { rateLimit } from "@/lib/auth/rate-limit";
import { ADMIN_POSITION_LABELS } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/auth/invite/validate — public, rate-limited, NON-consuming pre-check
// used by the signup admin path. Returns only non-sensitive context (course name +
// allowed positions). The invite is fully re-validated + consumed at final signup.
// The attempted code is never logged.
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(`invite-validate:${ip}`, 10, 5 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "יותר מדי ניסיונות. נסה שוב מאוחר יותר." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const code = typeof (body as Record<string, unknown>)?.inviteCode === "string"
    ? ((body as Record<string, unknown>).inviteCode as string)
    : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "יש להזין קוד הרשאה." }, { status: 400 });
  }

  const result = await validateInvite(code);
  if (!result.ok) {
    const map: Record<string, string> = {
      invalid: "קוד ההרשאה אינו תקין",
      expired: "קוד ההרשאה פג תוקף",
      used: "קוד ההרשאה כבר נוצל",
      revoked: "קוד ההרשאה בוטל",
    };
    return NextResponse.json({ error: map[result.reason] ?? "קוד ההרשאה אינו תקין" }, { status: 400 });
  }

  return NextResponse.json({
    courseName: result.courseName,
    allowedAdminPositions: result.allowedAdminPositions.map((p) => ({
      value: p,
      label: ADMIN_POSITION_LABELS[p],
    })),
  });
}
