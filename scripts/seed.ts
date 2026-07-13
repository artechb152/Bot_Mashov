/**
 * Demo seed script.
 *
 * Inserts a small set of clearly-marked EXAMPLE data (Hebrew) so the data layer
 * can be verified end to end. This is NOT real course content — every record is
 * labelled "דוגמה בלבד" / "תוכן דמו". The goal is to prove the system works,
 * not to author any professional training material.
 *
 * Run:  npm run seed   (requires MONGODB_URI in .env.local)
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  User,
  Trainee,
  Feedback,
  Simulation,
  Scenario,
  FinalExercise,
  KnowledgeDocument,
} from "@/models";

// Load .env / .env.local exactly like Next.js does (this is a standalone script,
// so nothing loads the env for us). Must run before we read process.env below.
loadEnvConfig(process.cwd());

async function seed(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error(
      [
        "",
        "[seed] חסר משתנה הסביבה MONGODB_URI — לא ניתן להריץ seed.",
        "[seed] Missing MONGODB_URI. Add it to .env.local, for example:",
        "       MONGODB_URI=mongodb://localhost:27017/matzpen",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  await connectToDatabase();
  console.log("[seed] מחובר. מאפס אוספי דמו…");

  // Reset only the collections we seed (safe on a development database).
  await Promise.all([
    User.deleteMany({}),
    Trainee.deleteMany({}),
    Feedback.deleteMany({}),
    Simulation.deleteMany({}),
    Scenario.deleteMany({}),
    FinalExercise.deleteMany({}),
    KnowledgeDocument.deleteMany({}),
  ]);

  // 1) One demo commander (passwordHash is a clearly-fake placeholder — no auth yet).
  const commander = await User.create({
    fullName: "מפקד לדוגמה",
    username: "mefaked.demo",
    passwordHash: "demo$placeholder-not-a-real-hash",
    courseType: "both",
    role: "commander",
  });

  // 2) Five demo trainees.
  const traineeCourses = ["kapeh", "maksim", "kapeh", "maksim", "both"] as const;
  const teamLabels = ["א", "ב", "ג", "א", "ב"];
  const trainees = await Trainee.create(
    Array.from({ length: 5 }, (_, i) => ({
      commanderId: commander._id,
      fullName: `חניך לדוגמה ${i + 1}`,
      courseType: traineeCourses[i],
      team: `צוות ${teamLabels[i]} (דוגמה)`,
      strengths: [`חוזקה לדוגמה ${i + 1}`],
      weaknesses: [`פער לדוגמה ${i + 1}`],
      notes: `תוכן דמו — הערה לדוגמה בלבד עבור חניך ${i + 1}.`,
    })),
  );

  // 3) Three demo feedback entries (AI fields are demo placeholders — AI not connected).
  const feedbackTypes = ["lesson", "simulation", "role_play"] as const;
  await Feedback.create(
    feedbackTypes.map((feedbackType, i) => ({
      commanderId: commander._id,
      traineeId: trainees[i]._id,
      feedbackType,
      rawText: `תוכן דמו — טקסט משוב לדוגמה בלבד (${feedbackType}).`,
      selectedAction: "פעולה לדוגמה",
      aiSummary: "דוגמה בלבד — לא נותח על ידי AI.",
      aiAnalysis: "תוכן דמו — ניתוח AI יופק בשלב מאוחר יותר.",
      aiRecommendations: ["המלצה לדוגמה בלבד"],
    })),
  );

  // 4) Four demo simulations.
  const simCourses = ["kapeh", "maksim", "both", "kapeh"] as const;
  const simDifficulties = ["easy", "medium", "hard", "medium"] as const;
  await Simulation.create(
    Array.from({ length: 4 }, (_, i) => ({
      title: `סימולציה לדוגמה ${i + 1}`,
      courseType: simCourses[i],
      skills: [`מיומנות לדוגמה ${i + 1}`],
      difficulty: simDifficulties[i],
      description: `תוכן דמו — תיאור סימולציה לדוגמה בלבד ${i + 1}.`,
      roles: ["תפקיד לדוגמה א'", "תפקיד לדוגמה ב'"],
      evaluationPoints: ["נקודת הערכה לדוגמה"],
      recommendedForWeaknesses: [`פער לדוגמה ${i + 1}`],
    })),
  );

  // 5) Three demo נע״ת scenarios.
  const scenarioCourses = ["kapeh", "maksim", "both"] as const;
  await Scenario.create(
    Array.from({ length: 3 }, (_, i) => ({
      title: `תרחיש נע״ת לדוגמה ${i + 1}`,
      courseType: scenarioCourses[i],
      description: `תוכן דמו — תיאור תרחיש נע״ת לדוגמה בלבד ${i + 1}.`,
      context: "הקשר לדוגמה בלבד.",
      roles: [
        {
          name: "תפקיד א' לדוגמה",
          description: "תיאור תפקיד לדוגמה בלבד.",
          responsibilities: ["אחריות לדוגמה"],
          expectedBehaviors: ["התנהגות צפויה לדוגמה"],
        },
        {
          name: "תפקיד ב' לדוגמה",
          description: "תיאור תפקיד לדוגמה בלבד.",
          responsibilities: ["אחריות לדוגמה"],
          expectedBehaviors: ["התנהגות צפויה לדוגמה"],
        },
      ],
      requiredSkills: ["מיומנות לדוגמה"],
      commonChallenges: ["אתגר נפוץ לדוגמה"],
      evaluationPoints: ["נקודת הערכה לדוגמה"],
    })),
  );

  // 6) One demo final exercise referencing existing demo trainees.
  await FinalExercise.create({
    commanderId: commander._id,
    groupName: "קבוצת דמו א'",
    traineeIds: trainees.slice(0, 3).map((t) => t._id),
    scenarioTitle: "תרחיש נע״ת לדוגמה 1",
    feedbackEntries: [
      {
        writerTraineeId: trainees[0]._id,
        targetTraineeId: trainees[1]._id,
        roleInScenario: "תפקיד לדוגמה",
        rawFeedback: "תוכן דמו — משוב לדוגמה בלבד.",
        mockAiFeedbackOnFeedback: "דוגמה בלבד — משוב-על-משוב יופק בשלב מאוחר יותר.",
      },
      {
        writerTraineeId: trainees[1]._id,
        targetTraineeId: trainees[2]._id,
        roleInScenario: "תפקיד לדוגמה",
        rawFeedback: "תוכן דמו — משוב לדוגמה בלבד.",
        mockAiFeedbackOnFeedback: "דוגמה בלבד — משוב-על-משוב יופק בשלב מאוחר יותר.",
      },
    ],
  });

  // 7) Five placeholder knowledge documents (no real course material).
  const knowledgeCategories = [
    "feedback_rubrics",
    "simulations",
    "scenarios",
    "final_exercise",
    "lessons",
  ] as const;
  const knowledgeStatuses = ["draft", "ready", "draft", "ready", "draft"] as const;
  await KnowledgeDocument.create(
    knowledgeCategories.map((category, i) => ({
      title: `מסמך ידע לדוגמה ${i + 1}`,
      category,
      sourceType: "manual",
      status: knowledgeStatuses[i],
      notes: "תוכן דמו — מסמך placeholder בלבד. אין כאן חומר קורס אמיתי.",
    })),
  );

  const counts = {
    users: await User.countDocuments(),
    trainees: await Trainee.countDocuments(),
    feedback: await Feedback.countDocuments(),
    simulations: await Simulation.countDocuments(),
    scenarios: await Scenario.countDocuments(),
    finalExercises: await FinalExercise.countDocuments(),
    knowledgeDocuments: await KnowledgeDocument.countDocuments(),
  };

  console.log("[seed] הסתיים. נכנסו נתוני דמו (דוגמה בלבד):");
  console.table(counts);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(async (error) => {
  console.error("[seed] נכשל:", error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
