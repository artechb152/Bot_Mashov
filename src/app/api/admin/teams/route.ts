import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { adminListTeams, adminCreateTeam } from "@/lib/data/org-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/teams?cohortId=… — teams (in scope).
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const cohortId = new URL(request.url).searchParams.get("cohortId") ?? undefined;
  return NextResponse.json({ teams: await adminListTeams(auth.grant, cohortId) });
}

// POST /api/admin/teams — create a team in a cohort (in scope).
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const result = await adminCreateTeam(auth.grant, {
    cohortId: typeof b.cohortId === "string" ? b.cohortId : "",
    name: typeof b.name === "string" ? b.name : "",
    code: typeof b.code === "string" ? b.code : undefined,
  });
  if (result.ok) return NextResponse.json({ team: result.team }, { status: 201 });
  const map: Record<string, string> = {
    invalid_cohort: "המחזור שנבחר אינו תקין.",
    invalid_input: "יש להזין שם צוות.",
    duplicate: "צוות בשם זה כבר קיים במחזור.",
    not_found: "לא נמצא.",
  };
  return NextResponse.json({ error: map[result.reason] ?? "יצירת הצוות נכשלה." }, { status: 400 });
}
