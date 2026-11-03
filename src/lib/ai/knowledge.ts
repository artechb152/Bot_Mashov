/**
 * חונך+ AI layer — system-knowledge loader (Stage 0, task-aware in the OpenAI stage).
 *
 * Assembles the SYSTEM side of the context (coaching doctrine + system prompt), which
 * is independent of any specific trainee. Reuses the existing seams: `getSystemPrompt()`
 * (src/lib/bot/system-prompt.md) and the knowledge base (knowledge/*.md via
 * `listKnowledgeEntries`).
 *
 * Two tiers, so we never dump examples/guides into every call:
 *   - BASE (always): the binding professional doctrine, models, guardrails, templates.
 *   - TASK-SPECIFIC (only for the current task): the final-evaluation guide + examples
 *     (final_evaluation) and the raw/real feedback examples (feedback_polish). These
 *     are REFERENCE material, rendered in their own section, and can never override the
 *     system prompt.
 *
 * Server-only (reads the filesystem) — never import from a Client Component.
 */
import { getSystemPrompt } from "@/lib/bot/prompts";
import { listKnowledgeEntries, type KnowledgeEntry } from "@/lib/knowledge/content";
import { versionOf } from "./context";
import type { AITask } from "./types";

export type AISystemKnowledge = {
  systemPrompt: string;
  systemPromptVersion: string;
  /** Binding professional knowledge loaded for every task. */
  knowledgeExcerpts: string[];
  /** Reference guides/examples loaded only for the current task (may be empty). */
  taskKnowledge: string[];
  /** Fingerprint of everything loaded (base + task), so any edit drives staleness. */
  knowledgeVersion: string;
};

/** Files that are NEVER part of the always-on base: examples, the golden tests, the
 *  simulation libraries, the source register, uploads guide, and the per-task final-
 *  evaluation guide/examples. They are loaded only when a task explicitly needs them. */
const NON_BASE_FILES = new Set([
  "00_example.md",
  "00_README_UPLOAD_GUIDE.md",
  "09_EXAMPLES_GOOD_BAD.md",
  "12_EVALUATION_GOLDEN_TESTS.md",
  "13_SOURCE_REGISTER.md",
  "14_SIMULATION_ENGINE.md",
  "15_SIMULATION_SCENARIO_LIBRARY.md",
  "17_FINAL_EVALUATION_GUIDE.md",
  "18_FINAL_EVALUATION_EXAMPLES.md",
  "19_REAL_FEEDBACK_EXAMPLES.md",
]);

/** The reference files to add for a specific task (guide first — it is binding over
 *  the examples on conflict). Ordered by precedence within the task section. */
const TASK_FILES: Partial<Record<AITask, string[]>> = {
  final_evaluation: ["17_FINAL_EVALUATION_GUIDE.md", "18_FINAL_EVALUATION_EXAMPLES.md"],
  // The aggregated review embeds a final-evaluation draft section → load its guide too.
  trainee_overview: ["17_FINAL_EVALUATION_GUIDE.md", "18_FINAL_EVALUATION_EXAMPLES.md"],
  feedback_polish: ["09_EXAMPLES_GOOD_BAD.md", "19_REAL_FEEDBACK_EXAMPLES.md"],
};

const baseName = (sourcePath: string): string => sourcePath.split("/").pop() ?? sourcePath;
const excerpt = (e: KnowledgeEntry): string => `## ${e.title}\n${e.body}`;

/** Load the system prompt + knowledge for a task, with stable version fingerprints. */
export async function loadAISystemKnowledge(task?: AITask): Promise<AISystemKnowledge> {
  const [systemPrompt, entries] = await Promise.all([
    getSystemPrompt().catch(() => ""),
    listKnowledgeEntries().catch(() => []),
  ]);

  const active = entries.filter((e) => e.status !== "archived");

  // Base = binding professional knowledge (excludes examples/guides always). "internal"
  // only hides a file from the /knowledge UI — it is still bot knowledge (e.g. the
  // sensitive-cases guardrails in 11_*), so the bot must receive it.
  const base = active.filter(
    (e) => (e.visibility === "public" || e.visibility === "internal") && !NON_BASE_FILES.has(baseName(e.sourcePath)),
  );

  // Task-specific = only the files this task needs (by filename), in precedence order.
  const wanted = task ? TASK_FILES[task] ?? [] : [];
  const taskEntries = wanted
    .map((fn) => active.find((e) => baseName(e.sourcePath) === fn))
    .filter((e): e is KnowledgeEntry => Boolean(e));

  // Version covers base + task, so editing any loaded file changes the version.
  const knowledgeVersion = versionOf([...base, ...taskEntries].map((e) => `${e.slug}:${e.contentHash}`).join("|"));

  return {
    systemPrompt,
    systemPromptVersion: versionOf(systemPrompt),
    knowledgeExcerpts: base.map(excerpt),
    taskKnowledge: taskEntries.map(excerpt),
    knowledgeVersion,
  };
}
