#!/usr/bin/env node
// Incremental RTL guard. Full audit: npm run check:rtl -- --all
// CI / PR: npm run check:rtl -- --base origin/main
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const all = args.includes("--all");
const baseIndex = args.indexOf("--base");
if (baseIndex >= 0 && !args[baseIndex + 1]) {
  console.error("Usage: check-rtl.mjs [--all] [--base <git-ref>]");
  process.exit(2);
}
const base = baseIndex >= 0 ? args[baseIndex + 1] : process.env.RTL_BASE_REF || "origin/main";
const errors = [];
const sourceFile = (file) =>
  /^src\/(?:app|components)\//.test(file) && /\.(tsx|jsx|css)$/.test(file) && !file.includes("/api/");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

function issues(line) {
  const result = [];
  // Physical-direction Tailwind tokens, with optional responsive/state prefixes.
  // Logical counterparts (start/end/ms/me/ps/pe) are intentionally permitted.
  if (/(?:^|[\s"'=])(?:-?[\w-]+:)*-?(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|text-left|text-right|float-left|float-right|origin-left|origin-right)(?:-[\w[\]./%-]+)?(?=[\s"'<>]|$)/.test(line)) {
    result.push("physical Tailwind utility; use logical start/end properties");
  }
  if (/(?:margin-left|margin-right|padding-left|padding-right|border-left(?:-[\w-]+)?|border-right(?:-[\w-]+)?|marginLeft|marginRight|paddingLeft|paddingRight|borderLeft|borderRight)\s*:/.test(line) ||
      /(?:^|[;{]\s*)(?:left|right)\s*:/.test(line) ||
      /(?:text-align|float|transform-origin)\s*:\s*(?:left|right)\b/.test(line)) {
    result.push("physical CSS / inline style property; use logical CSS");
  }
  if (/\bdir\s*=\s*["']ltr["']/.test(line) || /\bdir\s*=\s*\{\s*["']ltr["']\s*\}/.test(line)) {
    result.push("LTR override requires a local rtl-exception comment");
  }
  if (/\bflex-row-reverse\b/.test(line)) result.push("flex-row-reverse; fix DOM order instead");
  return result;
}

function inspect(file, lineNumber, content) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  const preceding = lines.slice(Math.max(0, lineNumber - 4), lineNumber).join("\n");
  // Only a precise, nearby, reasoned exception is valid.
  if (/(?:\/\/|\/\*|\*|<!--)\s*rtl-exception:\s*\S.{10,}/i.test(preceding)) return;
  for (const message of issues(content)) errors.push(file + ":" + lineNumber + ": " + message);
}

const layout = readFileSync("src/app/layout.tsx", "utf8");
if (!/<html\b[^>]*\blang=["']he["'][^>]*\bdir=["']rtl["']/.test(layout) &&
    !/<html\b[^>]*\bdir=["']rtl["'][^>]*\blang=["']he["']/.test(layout)) {
  errors.push('src/app/layout.tsx:1: root must declare lang="he" and dir="rtl"');
}

if (all) {
  for (const file of [...walk("src/app"), ...walk("src/components")].filter(sourceFile)) {
    readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => inspect(file, i + 1, line));
  }
} else {
  let diff;
  try {
    diff = execFileSync("git", ["diff", "--unified=0", "--diff-filter=ACMR",
      base + "...HEAD", "--", "src/app", "src/components"], { encoding: "utf8" });
  } catch {
    console.error("Unable to compare against " + base + ". Fetch the base branch or run with --all.");
    process.exit(2);
  }
  let file = "", lineNumber = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) { file = line.slice(6); continue; }
    if (line.startsWith("@@")) {
      const match = line.match(/\+(\d+)(?:,\d+)?/);
      if (match) lineNumber = Number(match[1]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (sourceFile(file) && existsSync(file)) inspect(file, lineNumber, line.slice(1));
      lineNumber++;
    } else if (line.startsWith(" ") && file) lineNumber++;
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error("\nTrue RTL guard failed (" + errors.length + " violations). See docs/RTL_POLICY.md.");
  process.exit(1);
}
console.log("True RTL guard passed (" + (all ? "full audit" : "added UI lines vs " + base) + ").");
