/**
 * Best-effort extraction of trainee fields from an uploaded file.
 *
 * Deliberately NOT clever. There is no AI here and no parsing library: only the
 * text formats that can be read reliably with plain string work are parsed
 * (txt / md / csv / json). Anything else — PDF, DOCX, images — is accepted and
 * attached to the trainee, but yields no fields and a warning telling the user to
 * fill the form in by hand. Guessing badly is worse than not guessing.
 *
 * The output is ALWAYS shown to the user for review before a trainee is created,
 * so an imperfect extraction is a convenience, never a correctness risk.
 *
 * This module is pure and total: it never throws, and never touches the DB.
 */

export type ParsedTraineeFields = {
  fullName: string;
  team: string;
  strengths: string[];
  weaknesses: string[];
  notes: string;
};

export type ParseTraineeResult = {
  fields: ParsedTraineeFields;
  /** Plain text of the file, when readable — stored for the future bot. */
  extractedText: string;
  /** User-facing Hebrew notices (e.g. "this format can't be read automatically"). */
  warnings: string[];
};

const EMPTY_FIELDS: ParsedTraineeFields = {
  fullName: "",
  team: "",
  strengths: [],
  weaknesses: [],
  notes: "",
};

export const UNSUPPORTED_FORMAT_WARNING =
  "לא ניתן לחלץ טקסט אוטומטית מסוג הקובץ הזה. הקובץ יצורף לחניך — יש למלא את השדות ידנית.";

const NOTHING_FOUND_WARNING =
  "לא זוהו שדות בקובץ. הקובץ יצורף לחניך — יש למלא את השדות ידנית.";

/* ---------------------------------------------------------------------------
 * Field vocabulary — Hebrew first, English accepted.
 * ------------------------------------------------------------------------- */

type FieldKey = "fullName" | "team" | "strengths" | "weaknesses" | "notes";

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  fullName: ["שם", "שם מלא", "שם החניך", "חניך", "name", "fullname", "full name", "full_name"],
  team: ["צוות", "team", "group", "כיתה", "מחלקה"],
  strengths: ["חוזקות", "חוזקה", "נקודות חוזק", "strengths", "strength"],
  weaknesses: [
    "חולשות",
    "חולשה",
    "פערים",
    "פער",
    "נקודות לשיפור",
    "weaknesses",
    "weakness",
    "gaps",
  ],
  notes: [
    "הערות",
    "הערות מפקד",
    "הערות סגל",
    "הערות מפקד/סגל",
    "הערות מפקד/חונך",
    "notes",
    "comments",
    "remarks",
  ],
};

/**
 * Normalise a key for matching: strip BOM, quotes, markdown heading marks, the
 * trailing colon, Hebrew geresh/gershayim variants, and collapse whitespace.
 */
function normaliseKey(raw: string): string {
  return raw
    .replace(/^﻿/, "")
    .replace(/^#+\s*/, "")
    .replace(/^[*_\s]+|[*_\s]+$/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/[:：]\s*$/, "")
    .replace(/[״”"׳’']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Which trainee field (if any) a key refers to. */
function matchField(rawKey: string): FieldKey | null {
  const key = normaliseKey(rawKey);
  if (!key) return null;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [FieldKey, string[]][]) {
    if (aliases.some((alias) => normaliseKey(alias) === key)) return field;
  }
  return null;
}

/** Strip a leading list marker: "- ", "* ", "• ", "1. ", "1) ". */
function stripBullet(line: string): string {
  return line.replace(/^\s*(?:[-*•·–—]|\d+[.)])\s+/, "").trim();
}

/**
 * Split one cell/value into list items. Accepts newlines, semicolons, pipes and
 * commas as separators — the formats staff actually produce by hand.
 */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  return String(value)
    .split(/[\n;|,]+/)
    .map((part) => stripBullet(part))
    .filter(Boolean);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join("\n");
  return String(value).trim();
}

/** True once anything at all was extracted. */
function hasAnyField(f: ParsedTraineeFields): boolean {
  return Boolean(
    f.fullName || f.team || f.notes || f.strengths.length > 0 || f.weaknesses.length > 0,
  );
}

/* ---------------------------------------------------------------------------
 * JSON
 * ------------------------------------------------------------------------- */

function parseJson(text: string): ParsedTraineeFields | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  // A file containing a single-element array of one trainee is common enough.
  if (Array.isArray(data)) data = data[0];
  if (typeof data !== "object" || data === null) return null;

  const fields: ParsedTraineeFields = { ...EMPTY_FIELDS, strengths: [], weaknesses: [] };
  for (const [rawKey, value] of Object.entries(data as Record<string, unknown>)) {
    const field = matchField(rawKey);
    if (!field) continue;
    if (field === "strengths" || field === "weaknesses") {
      fields[field] = toList(value);
    } else {
      fields[field] = toText(value);
    }
  }
  return fields;
}

/* ---------------------------------------------------------------------------
 * CSV — a tiny RFC4180-ish reader (quoted fields, escaped "" inside quotes).
 * ------------------------------------------------------------------------- */

function splitCsvRow(row: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (inQuotes) {
      if (char === '"') {
        if (row[i + 1] === '"') {
          cell += '"';
          i++; // escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseCsv(text: string): ParsedTraineeFields | null {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rows.length < 2) return null;

  // Pick whichever delimiter yields more columns in the header.
  const delimiter = splitCsvRow(rows[0], ";").length > splitCsvRow(rows[0], ",").length ? ";" : ",";

  const header = splitCsvRow(rows[0], delimiter);
  const values = splitCsvRow(rows[1], delimiter); // one trainee per import → first data row

  const fields: ParsedTraineeFields = { ...EMPTY_FIELDS, strengths: [], weaknesses: [] };
  let matched = false;

  header.forEach((rawKey, i) => {
    const field = matchField(rawKey);
    if (!field) return;
    matched = true;
    const value = values[i] ?? "";
    if (field === "strengths" || field === "weaknesses") {
      fields[field] = toList(value);
    } else {
      fields[field] = toText(value);
    }
  });

  return matched ? fields : null;
}

/* ---------------------------------------------------------------------------
 * Markdown / plain text
 *
 * Handles both shapes staff actually write:
 *   "שם: עדי שגב"                 → inline "key: value"
 *   "## חוזקות" + "- יוזמה"        → a heading followed by a list
 * ------------------------------------------------------------------------- */

function parseMarkdown(text: string): ParsedTraineeFields | null {
  const fields: ParsedTraineeFields = { ...EMPTY_FIELDS, strengths: [], weaknesses: [] };
  const buckets: Record<"strengths" | "weaknesses" | "notes", string[]> = {
    strengths: [],
    weaknesses: [],
    notes: [],
  };

  let section: "strengths" | "weaknesses" | "notes" | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const isHeading = /^#{1,6}\s/.test(line);

    // "key: value" on one line — only when the value is non-empty.
    const inline = line.match(/^([^:：]{1,40})[:：]\s*(.+)$/);
    if (!isHeading && inline) {
      const field = matchField(inline[1]);
      if (field) {
        const value = inline[2].trim();
        if (field === "strengths" || field === "weaknesses") {
          buckets[field].push(...toList(value));
        } else if (field === "notes") {
          buckets.notes.push(value);
        } else {
          fields[field] = value;
        }
        section = null;
        continue;
      }
    }

    // A section header — either "## חוזקות" or a bare "חוזקות" / "חוזקות:" line.
    const asSection = matchField(line);
    if (asSection) {
      if (asSection === "strengths" || asSection === "weaknesses" || asSection === "notes") {
        section = asSection;
      } else {
        section = null;
      }
      continue;
    }

    // Any other heading closes the current section.
    if (isHeading) {
      section = null;
      continue;
    }

    if (section) buckets[section].push(stripBullet(line));
  }

  fields.strengths = buckets.strengths.filter(Boolean);
  fields.weaknesses = buckets.weaknesses.filter(Boolean);
  fields.notes = buckets.notes.filter(Boolean).join("\n");

  return hasAnyField(fields) ? fields : null;
}

/* ---------------------------------------------------------------------------
 * Entry point
 * ------------------------------------------------------------------------- */

/** Formats we can read text out of. Everything else is attach-only. */
function detectFormat(mimeType: string, filename: string): "json" | "csv" | "text" | null {
  const mime = (mimeType || "").toLowerCase();
  const ext = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

  if (mime === "application/json" || ext === "json") return "json";
  if (mime === "text/csv" || ext === "csv") return "csv";
  if (mime === "text/plain" || mime === "text/markdown" || ext === "txt" || ext === "md") {
    return "text";
  }
  return null;
}

/** True if this file has a chance of yielding fields (used to set expectations in the UI). */
export function isParsableFile(mimeType: string, filename: string): boolean {
  return detectFormat(mimeType, filename) !== null;
}

/**
 * Extract what we can. Always returns a result — never throws, never rejects a
 * file. An unreadable format simply comes back with empty fields and a warning.
 */
export function parseTraineeFile(
  content: Buffer,
  mimeType: string,
  filename: string,
): ParseTraineeResult {
  const format = detectFormat(mimeType, filename);

  if (!format) {
    return {
      fields: { ...EMPTY_FIELDS, strengths: [], weaknesses: [] },
      extractedText: "",
      warnings: [UNSUPPORTED_FORMAT_WARNING],
    };
  }

  // Strip a UTF-8 BOM so the first key of a Windows-authored file still matches.
  const text = content.toString("utf8").replace(/^﻿/, "");

  let fields: ParsedTraineeFields | null = null;
  if (format === "json") {
    fields = parseJson(text);
  } else if (format === "csv") {
    fields = parseCsv(text);
  } else {
    fields = parseMarkdown(text);
  }

  // A readable file we could not make sense of: keep its text (useful to the
  // future bot), but tell the user they need to fill the form in themselves.
  if (!fields || !hasAnyField(fields)) {
    return {
      fields: { ...EMPTY_FIELDS, strengths: [], weaknesses: [] },
      extractedText: text,
      warnings: [NOTHING_FOUND_WARNING],
    };
  }

  const warnings: string[] = [];
  if (!fields.fullName) {
    warnings.push("לא זוהה שם חניך בקובץ — יש להזין אותו ידנית.");
  }

  return { fields, extractedText: text, warnings };
}
