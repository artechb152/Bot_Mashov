/**
 * Non-destructive helper: sets a REAL (hashed) password on the EXISTING demo
 * commander so you can log in and see the already-seeded trainees. It only
 * updates that one user's passwordHash — it deletes/creates nothing else.
 *
 * Run:  npm run demo:password
 */
import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";

loadEnvConfig(process.cwd());

const DEMO_USERNAME = "mefaked.demo";
const DEMO_PASSWORD = "Matzpen2026";

async function run(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error("[demo] חסר MONGODB_URI ב-.env.local.");
    process.exit(1);
  }
  await connectToDatabase();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const res = await User.updateOne({ username: DEMO_USERNAME }, { $set: { passwordHash } });

  if (res.matchedCount === 0) {
    console.log(`[demo] לא נמצא משתמש "${DEMO_USERNAME}" — לא בוצע שינוי.`);
  } else {
    console.log(`[demo] הוגדרה סיסמה למשתמש הדמו הקיים.`);
    console.log(`[demo] התחברות → שם משתמש: ${DEMO_USERNAME}   סיסמה: ${DEMO_PASSWORD}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("[demo] נכשל:", err);
  process.exit(1);
});
