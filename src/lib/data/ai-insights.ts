import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { TraineeAIInsight } from "@/models";
import type { AIArtifactTask, InsightStatus } from "@/lib/ai/types";

/**
 * Versioned trainee AI-artifact data layer. UNSCOPED — the caller MUST authorize the
 * trainee (`requireTraineeAccess`) first. Artifacts are never overwritten: saving a
 * new one supersedes the prior current one; changing a source feedback marks
 * referencing artifacts stale (best-effort, never blocks the feedback write).
 */

export type InsightInput = {
  createdBy: string;
  conversationId?: string | null;
  artifactType: AIArtifactTask;
  sourceFeedbackIds: string[];
  structuredOutput: unknown;
  contextHash: string;
  provider: string;
  model: string;
  systemPromptVersion: string;
  knowledgeVersion: string;
};

export type InsightDTO = {
  id: string;
  traineeId: string;
  artifactType: AIArtifactTask;
  structuredOutput: unknown;
  sourceFeedbackIds: string[];
  contextHash: string;
  provider: string;
  model: string;
  systemPromptVersion: string;
  knowledgeVersion: string;
  status: InsightStatus;
  staleAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type LeanInsight = {
  _id: unknown;
  traineeId?: unknown;
  artifactType?: string;
  structuredOutput?: unknown;
  sourceFeedbackIds?: unknown[];
  contextHash?: string;
  provider?: string;
  model?: string;
  systemPromptVersion?: string;
  knowledgeVersion?: string;
  status?: string;
  staleAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const iso = (v?: Date | string | null): string | null => (v ? new Date(v).toISOString() : null);

function serialize(doc: LeanInsight): InsightDTO {
  return {
    id: String(doc._id),
    traineeId: doc.traineeId ? String(doc.traineeId) : "",
    artifactType: (doc.artifactType as AIArtifactTask) ?? "trainee_review",
    structuredOutput: doc.structuredOutput ?? null,
    sourceFeedbackIds: Array.isArray(doc.sourceFeedbackIds) ? doc.sourceFeedbackIds.map((x) => String(x)) : [],
    contextHash: doc.contextHash ?? "",
    provider: doc.provider ?? "",
    model: doc.model ?? "",
    systemPromptVersion: doc.systemPromptVersion ?? "",
    knowledgeVersion: doc.knowledgeVersion ?? "",
    status: (doc.status as InsightStatus) ?? "current",
    staleAt: iso(doc.staleAt ?? null),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

/** Save a new artifact as "current", superseding any prior current of the same type. */
export async function saveInsight(traineeId: string, input: InsightInput): Promise<InsightDTO | null> {
  if (!isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  await TraineeAIInsight.updateMany(
    { traineeId, artifactType: input.artifactType, status: "current" },
    { $set: { status: "superseded" } },
  );
  const doc = await TraineeAIInsight.create({
    traineeId,
    createdBy: input.createdBy,
    conversationId: input.conversationId || undefined,
    artifactType: input.artifactType,
    sourceFeedbackIds: input.sourceFeedbackIds.filter((id) => isValidObjectId(id)).map((id) => new Types.ObjectId(id)),
    structuredOutput: input.structuredOutput,
    contextHash: input.contextHash,
    provider: input.provider,
    model: input.model,
    systemPromptVersion: input.systemPromptVersion,
    knowledgeVersion: input.knowledgeVersion,
    status: "current",
  });
  return serialize(doc.toObject() as LeanInsight);
}

/** List a trainee's artifacts (current + stale by default; superseded on request). UNSCOPED. */
export async function listInsights(
  traineeId: string,
  opts: { artifactType?: AIArtifactTask; includeSuperseded?: boolean } = {},
): Promise<InsightDTO[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const q: Record<string, unknown> = { traineeId };
  if (opts.artifactType) q.artifactType = opts.artifactType;
  q.status = opts.includeSuperseded ? { $in: ["current", "stale", "superseded"] } : { $in: ["current", "stale"] };
  const docs = await TraineeAIInsight.find(q).sort({ createdAt: -1, _id: -1 }).lean<LeanInsight[]>();
  return docs.map(serialize);
}

/**
 * Mark a trainee's current artifacts as STALE after a feedback change. Best-effort
 * (never throws — a staleness hiccup must not fail the feedback write):
 *   - `changedFeedbackId` given (edit/archive/restore) → only artifacts that cite it;
 *   - omitted (a NEW feedback) → all current artifacts (a new source may belong in any).
 */
export async function markInsightsStaleForTrainee(
  traineeId: string,
  opts: { changedFeedbackId?: string } = {},
): Promise<void> {
  try {
    if (!isValidObjectId(traineeId)) return;
    await connectToDatabase();
    const filter: Record<string, unknown> = { traineeId, status: "current" };
    if (opts.changedFeedbackId && isValidObjectId(opts.changedFeedbackId)) {
      filter.sourceFeedbackIds = new Types.ObjectId(opts.changedFeedbackId);
    }
    await TraineeAIInsight.updateMany(filter, { $set: { status: "stale", staleAt: new Date() } });
  } catch (err) {
    console.error("[ai-insights] markInsightsStaleForTrainee failed:", err);
  }
}
