import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Metadata mirror for file-sourced knowledge documents. The Markdown FILES in
 * `knowledge/` are the source of truth; `scripts/sync-knowledge.ts` upserts each
 * file's metadata here (keyed by `slug`).
 *
 * `category` and `status` are free-text (the frontmatter uses Hebrew categories
 * such as "חניכה" and a "active" status), so they are plain strings rather than
 * enums. `slug` is sparse+unique so any legacy seed docs without a slug remain
 * valid while file-sourced docs are uniquely keyed.
 */
const knowledgeDocumentSchema = new Schema(
  {
    slug: { type: String, unique: true, sparse: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    unit: { type: String, default: "" },
    order: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    status: { type: String, default: "active" },
    // "public" (a user-facing bot source) or "internal" (system prompt / config /
    // guardrails / eval — used by the bot, never shown to users).
    visibility: { type: String, default: "public" },
    sourceType: { type: String, default: "file" },
    sourcePath: { type: String, default: "" },
    // Checksum of the source file — lets the sync detect content changes.
    contentHash: { type: String, default: "" },
    // When this record was last written by the sync.
    syncedAt: { type: Date },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export type KnowledgeDocumentDoc = InferSchemaType<typeof knowledgeDocumentSchema>;

export const KnowledgeDocument: Model<KnowledgeDocumentDoc> =
  (models.KnowledgeDocument as Model<KnowledgeDocumentDoc>) ??
  model<KnowledgeDocumentDoc>("KnowledgeDocument", knowledgeDocumentSchema);
