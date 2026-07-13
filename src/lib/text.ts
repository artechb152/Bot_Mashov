/**
 * Text helpers for the "one line = one array item" pattern used by the
 * strengths / weaknesses inputs.
 */

/** Split free text into a trimmed array, one item per non-empty line. */
export function linesToArray(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Join an array back into newline-separated text (for editing in a textarea). */
export function arrayToLines(items: string[] | undefined | null): string {
  return (items ?? []).join("\n");
}
