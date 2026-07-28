/**
 * Smoke check for the trainee-import parser.
 *
 * The parser is the riskiest new logic in the import flow (free-form Hebrew text
 * in, structured fields out), so it gets exercised directly. It is a pure
 * function, so this needs no database, no server and no test runner — just tsx,
 * which is already a devDependency.
 *
 * Run:  npx tsx scripts/check-import-parser.ts
 */
import {
  parseTraineeFile,
  isParsableFile,
  UNSUPPORTED_FORMAT_WARNING,
} from "@/lib/import/parse-trainee-file";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`);
  }
}

function buf(s: string): Buffer {
  return Buffer.from(s, "utf8");
}

console.log("\nparse-trainee-file\n");

/* --- JSON ---------------------------------------------------------------- */
console.log("JSON (Hebrew keys)");
{
  const r = parseTraineeFile(
    buf(
      JSON.stringify({
        שם: "עדי שגב",
        צוות: "א",
        חוזקות: ["יוזמה", "עבודת צוות"],
        חולשות: ["ניהול זמן"],
        הערות: "מתקדם יפה.",
      }),
    ),
    "application/json",
    "trainee.json",
  );
  check("fullName", r.fields.fullName, "עדי שגב");
  check("team", r.fields.team, "א");
  check("strengths", r.fields.strengths, ["יוזמה", "עבודת צוות"]);
  check("weaknesses", r.fields.weaknesses, ["ניהול זמן"]);
  check("notes", r.fields.notes, "מתקדם יפה.");
  check("no warnings", r.warnings, []);
}

console.log("\nJSON (English keys, comma-separated strings)");
{
  const r = parseTraineeFile(
    buf(JSON.stringify({ fullName: "Dana Levi", team: "B", strengths: "initiative, focus" })),
    "application/json",
    "t.json",
  );
  check("fullName", r.fields.fullName, "Dana Levi");
  check("strengths split", r.fields.strengths, ["initiative", "focus"]);
}

/* --- CSV ----------------------------------------------------------------- */
console.log("\nCSV (Hebrew header, quoted multi-value cell)");
{
  const csv = ['שם,צוות,חוזקות,חולשות,הערות', '"עדי שגב",א,"יוזמה; עבודת צוות","ניהול זמן",הערה'].join(
    "\n",
  );
  const r = parseTraineeFile(buf(csv), "text/csv", "t.csv");
  check("fullName", r.fields.fullName, "עדי שגב");
  check("team", r.fields.team, "א");
  check("strengths", r.fields.strengths, ["יוזמה", "עבודת צוות"]);
  check("weaknesses", r.fields.weaknesses, ["ניהול זמן"]);
  check("notes", r.fields.notes, "הערה");
}

/* --- Markdown ------------------------------------------------------------ */
console.log("\nMarkdown (headings + bullets)");
{
  const md = [
    "# תיק חניך",
    "שם: עדי שגב",
    "צוות: א",
    "",
    "## חוזקות",
    "- יוזמה",
    "- עבודת צוות",
    "",
    "## חולשות",
    "* ניהול זמן",
    "",
    "## הערות מפקד",
    "משתפר משמעותית.",
  ].join("\n");
  const r = parseTraineeFile(buf(md), "text/markdown", "t.md");
  check("fullName", r.fields.fullName, "עדי שגב");
  check("team", r.fields.team, "א");
  check("strengths", r.fields.strengths, ["יוזמה", "עבודת צוות"]);
  check("weaknesses", r.fields.weaknesses, ["ניהול זמן"]);
  check("notes", r.fields.notes, "משתפר משמעותית.");
}

console.log("\nPlain text (inline key: value only)");
{
  const txt = ["שם מלא: יואב כהן", "צוות: ג", "חוזקות: יוזמה, דיוק", "חולשות: סבלנות"].join("\n");
  const r = parseTraineeFile(buf(txt), "text/plain", "t.txt");
  check("fullName", r.fields.fullName, "יואב כהן");
  check("team", r.fields.team, "ג");
  check("strengths", r.fields.strengths, ["יוזמה", "דיוק"]);
  check("weaknesses", r.fields.weaknesses, ["סבלנות"]);
}

/* --- Unsupported --------------------------------------------------------- */
console.log("\nUnsupported format (PDF)");
{
  const r = parseTraineeFile(buf("%PDF-1.7 binary junk"), "application/pdf", "feedback.pdf");
  check("isParsableFile=false", isParsableFile("application/pdf", "feedback.pdf"), false);
  check("no fields", r.fields.fullName, "");
  check("no extracted text", r.extractedText, "");
  check("warns", r.warnings, [UNSUPPORTED_FORMAT_WARNING]);
}

console.log("\nReadable but unrecognised content");
{
  const r = parseTraineeFile(buf("שלום, זה סתם טקסט חופשי ללא שדות."), "text/plain", "x.txt");
  check("no fields", r.fields.fullName, "");
  check("keeps text for the bot", r.extractedText.length > 0, true);
  check("warns (1)", r.warnings.length, 1);
}

console.log("\nMalformed JSON does not throw");
{
  const r = parseTraineeFile(buf("{ not json at all "), "application/json", "bad.json");
  check("no fields", r.fields.fullName, "");
  check("warns (1)", r.warnings.length, 1);
}

console.log("\nMissing name in an otherwise valid file");
{
  const r = parseTraineeFile(buf("חוזקות: יוזמה"), "text/plain", "t.txt");
  check("strengths parsed", r.fields.strengths, ["יוזמה"]);
  check("warns about name", r.warnings.length, 1);
}

console.log("");
if (failures > 0) {
  console.error(`✗ ${failures} check(s) failed\n`);
  process.exit(1);
}
console.log("✓ all parser checks passed\n");
