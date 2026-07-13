import { connectToDatabase } from "@/lib/db/mongoose";
import { KnowledgeDocument } from "@/models";

/**
 * Read-side access to the synced KnowledgeDocument metadata. The `/knowledge`
 * pages read from here (MongoDB); the Markdown body is loaded separately from
 * the source file. Only file-sourced docs (those with a slug) are returned —
 * legacy seed docs without a slug are ignored, not deleted.
 */

export type KnowledgeDocDTO = {
  slug: string;
  title: string;
  description: string;
  category: string;
  unit: string;
  order: number;
  tags: string[];
  status: string;
  visibility: string;
  sourcePath: string;
  syncedAt: string | null;
  updatedAt: string | null;
};

type LeanKnowledgeDoc = {
  slug?: string;
  title?: string;
  description?: string;
  category?: string;
  unit?: string;
  order?: number;
  tags?: string[];
  status?: string;
  visibility?: string;
  sourcePath?: string;
  syncedAt?: Date | string;
  updatedAt?: Date | string;
};

function serialize(doc: LeanKnowledgeDoc): KnowledgeDocDTO {
  return {
    slug: doc.slug ?? "",
    title: doc.title ?? "",
    description: doc.description ?? "",
    category: doc.category ?? "",
    unit: doc.unit ?? "",
    order: typeof doc.order === "number" ? doc.order : 0,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    status: doc.status ?? "",
    visibility: doc.visibility ?? "public",
    sourcePath: doc.sourcePath ?? "",
    syncedAt: doc.syncedAt ? new Date(doc.syncedAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

// File-sourced docs (have a slug), excluding archived ones and internal ones —
// internal docs (system prompt / config / guardrails) are kept in the DB for the
// future bot but never shown to users in "מקורות הבוט".
const FILE_SOURCED = {
  slug: { $exists: true, $nin: [null, ""] },
  status: { $ne: "archived" },
  visibility: { $ne: "internal" },
} as const;

export async function listKnowledgeDocuments(): Promise<KnowledgeDocDTO[]> {
  await connectToDatabase();
  const docs = await KnowledgeDocument.find(FILE_SOURCED)
    .sort({ order: 1, title: 1 })
    .lean<LeanKnowledgeDoc[]>();
  return docs.map(serialize);
}

export async function getKnowledgeDocument(slug: string): Promise<KnowledgeDocDTO | null> {
  await connectToDatabase();
  const doc = await KnowledgeDocument.findOne({ slug }).lean<LeanKnowledgeDoc | null>();
  return doc ? serialize(doc) : null;
}
