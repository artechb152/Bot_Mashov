/**
 * Knowledge sync — mirrors the metadata of every file in `knowledge/` into
 * MongoDB (KnowledgeDocument), keyed by slug. The files stay the source of
 * truth; this keeps a queryable metadata index in the DB.
 *
 * NOTHING here calls any AI / external API. It only reads local files and writes
 * metadata to Mongo.
 *
 * Behaviour:
 *   - upsert by slug; a file whose contentHash changed is updated, otherwise
 *     left unchanged.
 *   - stale docs (in DB with a slug, but no matching file) are ARCHIVED
 *     (status = "archived"), never silently deleted.
 *   - prints a clear summary at the end.
 *
 * Run:  npm run knowledge:sync   (requires MONGODB_URI in .env.local)
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { KnowledgeDocument } from "@/models";
import { listKnowledgeEntries } from "@/lib/knowledge/content";

loadEnvConfig(process.cwd());

async function syncKnowledge(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error(
      [
        "",
        "[knowledge] חסר משתנה הסביבה MONGODB_URI — לא ניתן לסנכרן.",
        "[knowledge] Missing MONGODB_URI. Add it to .env.local, for example:",
        "       MONGODB_URI=mongodb://localhost:27017/matzpen",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const entries = await listKnowledgeEntries();
  await connectToDatabase();
  console.log(`[knowledge] נמצאו ${entries.length} קבצי ידע בתיקייה knowledge/.`);

  const now = new Date();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    try {
      const existing = await KnowledgeDocument.findOne({ slug: entry.slug })
        .select("contentHash status")
        .lean<{ contentHash?: string; status?: string } | null>();

      const fields = {
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        category: entry.category,
        unit: entry.unit,
        order: entry.order,
        tags: entry.tags,
        status: entry.status,
        visibility: entry.visibility,
        sourceType: "file",
        sourcePath: entry.sourcePath,
        contentHash: entry.contentHash,
        syncedAt: now,
      };

      if (!existing) {
        await KnowledgeDocument.create(fields);
        created++;
      } else if (existing.contentHash !== entry.contentHash) {
        await KnowledgeDocument.updateOne({ slug: entry.slug }, { $set: fields });
        updated++;
      } else if (existing.status !== entry.status) {
        // Content is identical but the status drifted (e.g. the doc was archived
        // and the file later returned) — re-sync the status so it isn't hidden.
        await KnowledgeDocument.updateOne(
          { slug: entry.slug },
          { $set: { status: entry.status, syncedAt: now } },
        );
        updated++;
      } else {
        unchanged++;
      }
    } catch (error) {
      errors.push(`${entry.slug}: ${(error as Error).message}`);
    }
  }

  // Stale file-sourced docs → archive (clear marking), never auto-delete.
  const fileSlugs = new Set(entries.map((e) => e.slug));
  const dbDocs = await KnowledgeDocument.find({ slug: { $exists: true, $nin: [null, ""] } })
    .select("slug status")
    .lean<{ slug?: string; status?: string }[]>();

  let archived = 0;
  for (const doc of dbDocs) {
    if (doc.slug && !fileSlugs.has(doc.slug) && doc.status !== "archived") {
      await KnowledgeDocument.updateOne(
        { slug: doc.slug },
        { $set: { status: "archived", syncedAt: now } },
      );
      archived++;
    }
  }

  console.log("\n[knowledge] סיכום סנכרון:");
  console.log(`  נמצאו קבצים:            ${entries.length}`);
  console.log(`  נוצרו:                  ${created}`);
  console.log(`  עודכנו (תוכן השתנה):    ${updated}`);
  console.log(`  ללא שינוי:              ${unchanged}`);
  console.log(`  אורכבו (אין קובץ מקור): ${archived}`);
  console.log(`  שגיאות:                 ${errors.length}`);
  errors.forEach((message) => console.log(`    - ${message}`));

  await mongoose.disconnect();
  process.exit(errors.length > 0 ? 1 : 0);
}

syncKnowledge().catch(async (error) => {
  console.error("[knowledge] הסנכרון נכשל:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
