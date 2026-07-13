import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";

/**
 * Reads knowledge content from the Markdown files in the project's `knowledge/`
 * directory. The FILES are the source of truth; MongoDB (KnowledgeDocument) is a
 * metadata mirror populated by `scripts/sync-knowledge.ts`.
 *
 * Server-only (uses the filesystem) — do not import from a Client Component.
 */

export type KnowledgeEntry = {
  slug: string;
  title: string;
  description: string;
  category: string;
  unit: string;
  order: number;
  tags: string[];
  status: string;
  /** "public" (user-facing bot source) or "internal" (system/config, hidden from users). */
  visibility: string;
  /** Raw Markdown body (frontmatter stripped). */
  body: string;
  /** Repo-relative path to the source file. */
  sourcePath: string;
  /** SHA-256 of the whole file (frontmatter + body) — used to detect changes. */
  contentHash: string;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");

/**
 * Files skipped by the scan: the folder README, and the pre-combined bundle
 * (`mentor_feedback_knowledge_combined.md`) which just concatenates every other
 * file — it is kept on disk but not shown as its own knowledge document.
 */
const IGNORED_BASENAMES = new Set(["readme.md", "mentor_feedback_knowledge_combined.md"]);

function toStr(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function toTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

function toOrder(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fileNameToSlug(fileName: string): string {
  return fileName.replace(/\.md$/i, "").trim();
}

async function readEntry(relPath: string): Promise<KnowledgeEntry | null> {
  try {
    const raw = await fs.readFile(path.join(KNOWLEDGE_DIR, relPath), "utf8");
    const { data, content } = matter(raw);
    // slug from frontmatter or the file's basename → stays stable even if the
    // file is moved into a sub-folder.
    const slug = toStr(data.slug) || fileNameToSlug(path.basename(relPath));
    if (!slug) return null;

    return {
      slug,
      title: toStr(data.title) || slug,
      description: toStr(data.description),
      category: toStr(data.category),
      unit: toStr(data.unit),
      order: toOrder(data.order),
      tags: toTags(data.tags),
      status: toStr(data.status) || "active",
      visibility: toStr(data.visibility) || "public",
      body: content.trim(),
      sourcePath: path.posix.join("knowledge", relPath),
      contentHash: createHash("sha256").update(raw).digest("hex"),
    };
  } catch (error) {
    // A single malformed file (e.g. invalid YAML frontmatter) must not break the
    // whole scan — skip it with a warning.
    console.warn(
      `[knowledge] דילוג על קובץ עם frontmatter לא תקין: ${relPath} — ${(error as Error).message}`,
    );
    return null;
  }
}

export async function listKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  let allEntries: string[];
  try {
    // Recursive so knowledge files can live in sub-folders too.
    allEntries = await fs.readdir(KNOWLEDGE_DIR, { recursive: true });
  } catch {
    // Directory missing — treat as no knowledge yet rather than crashing.
    return [];
  }

  const markdownFiles = allEntries
    .map((name) => name.split(path.sep).join("/")) // normalise Windows separators
    .filter(
      (rel) =>
        rel.toLowerCase().endsWith(".md") &&
        !IGNORED_BASENAMES.has(path.basename(rel).toLowerCase()),
    );

  const parsed = (await Promise.all(markdownFiles.map(readEntry))).filter(
    (entry): entry is KnowledgeEntry => entry !== null,
  );

  // De-duplicate by slug (first file wins, deterministically) so a slug
  // collision can never silently clobber another document downstream.
  const entries: KnowledgeEntry[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    if (seen.has(entry.slug)) {
      console.warn(
        `[knowledge] דילוג על slug כפול: "${entry.slug}" (${entry.sourcePath}) — כבר קיים קובץ עם מזהה זה.`,
      );
      continue;
    }
    seen.add(entry.slug);
    entries.push(entry);
  }

  entries.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "he"));
  return entries;
}

export async function getKnowledgeEntryBySlug(slug: string): Promise<KnowledgeEntry | null> {
  const entries = await listKnowledgeEntries();
  return entries.find((entry) => entry.slug === slug) ?? null;
}
