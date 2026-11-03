import { NextResponse } from "next/server";
import { requireTraineeAccess } from "@/lib/auth/access";
import { listInsights } from "@/lib/data/ai-insights";
import { isAIArtifactTask } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/trainees/[id]/insights — current + stale AI artifacts (VIEW access). ?type= filters.
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await requireTraineeAccess(id);
  if (!access.ok) return access.response;

  try {
    const typeParam = new URL(request.url).searchParams.get("type");
    const artifactType = typeParam && isAIArtifactTask(typeParam) ? typeParam : undefined;
    const insights = await listInsights(id, { artifactType });
    return NextResponse.json({ insights });
  } catch (error) {
    console.error("[api/trainees/:id/insights] GET failed:", error);
    return NextResponse.json({ error: "טעינת התובנות נכשלה." }, { status: 500 });
  }
}
