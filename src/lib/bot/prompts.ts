import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Internal bot prompts. NOTHING here is wired to any AI / external API yet — this
 * only makes the system prompt available for the FUTURE assistant layer. It is
 * intentionally not imported anywhere in the running app.
 *
 * Server-only (reads the filesystem).
 */

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "src", "lib", "bot", "system-prompt.md");

/** Reads the bot's internal system prompt (src/lib/bot/system-prompt.md). */
export async function getSystemPrompt(): Promise<string> {
  return fs.readFile(SYSTEM_PROMPT_PATH, "utf8");
}
