import { redirect } from "next/navigation";

/**
 * The knowledge base is INTERNAL infrastructure for the future bot — it is not a
 * user-facing module, so this route no longer renders a browsable explorer of the
 * bot's sources. It redirects rather than 404s, exactly like `/dashboard` does,
 * so any existing link or bookmark still lands somewhere sensible.
 *
 * NOTHING was deleted to achieve this. The knowledge implementation is intact and
 * still used behind the scenes:
 *
 *   knowledge/*.md                  — the source documents
 *   src/models/KnowledgeDocument.ts — the synced metadata index
 *   src/lib/data/knowledge.ts       — the (now unexposed) data layer
 *   src/lib/knowledge/content.ts    — the filesystem reader
 *   scripts/sync-knowledge.ts       — `npm run knowledge:sync`
 *   src/components/knowledge/*      — the explorer + markdown renderer
 *
 * To bring the module back, restore this page's original body from git history —
 * every dependency it needs is still present.
 */
export default function KnowledgePage() {
  redirect("/assistant");
}
