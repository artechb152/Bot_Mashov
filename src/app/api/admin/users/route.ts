import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { listAllUsers } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/admin/users — all users, both courses (admin only).
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const users = await listAllUsers(auth.grant);
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[api/admin/users] GET failed:", error);
    return NextResponse.json({ error: "טעינת המשתמשים נכשלה." }, { status: 500 });
  }
}
