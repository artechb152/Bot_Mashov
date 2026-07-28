import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  adminUpdateCohort,
  adminSetCohortStatus,
  adminGetCohort,
} from "@/lib/data/org-admin";
import { isCohortStatus } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/cohorts/[id] — edit / archive / restore a cohort (in scope).
// Body may include { name?, code?, status? }.
export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  if (isCohortStatus(b.status)) {
    const r = await adminSetCohortStatus(auth.grant, id, b.status);
    if (!r.ok) return NextResponse.json({ error: "לא נמצא או אין הרשאה." }, { status: 404 });
  }
  if (typeof b.name === "string" || typeof b.code === "string") {
    const r = await adminUpdateCohort(auth.grant, id, {
      name: typeof b.name === "string" ? b.name : undefined,
      code: typeof b.code === "string" ? b.code : undefined,
    });
    if (!r.ok) return NextResponse.json({ error: "עדכון המחזור נכשל." }, { status: 400 });
  }

  const cohort = await adminGetCohort(auth.grant, id);
  if (!cohort) return NextResponse.json({ error: "לא נמצא." }, { status: 404 });
  return NextResponse.json({ cohort });
}
