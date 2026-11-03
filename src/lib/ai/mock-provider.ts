/**
 * חונך+ AI layer — deterministic Mock Provider (Stage 0).
 *
 * FOR DEVELOPMENT ONLY. Selected exclusively when `AI_PROVIDER=mock` (see
 * `./index`); in production the factory returns the Null Provider instead, so the
 * mock never reaches a real user. Its purpose is to exercise the full pipeline
 * (context → provider → structured output → validation → persistence/UI) without
 * any network or LLM.
 *
 * Strictly DETERMINISTIC: no Math.random, no Date.now — the same (input, context)
 * always yields byte-identical output, so it is testable and diff-friendly. Pure.
 */
import { defineStructuredProvider, type TaskHandlers } from "./provider";
import { FEEDBACK_TYPE_LABELS } from "@/lib/domain/types";
import type { AIContext, AIFeedbackItem } from "./types";

const firstLine = (text: string): string => {
  const line = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return line ?? "";
};

const traineeName = (ctx: AIContext): string => ctx.trainee?.fullName ?? "החניך";
const ids = (feedback: AIFeedbackItem[]): string[] => feedback.map((f) => f.id);

const handlers: TaskHandlers = {
  chat: (input, ctx) => {
    const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
    const n = ctx.feedback.length;
    return {
      reply:
        `(תצוגת פיתוח) קיבלתי: "${firstLine(lastUser?.content ?? "")}". ` +
        `אני עובד על ${traineeName(ctx)} עם ${n} משובים מסומנים כמקור.`,
    };
  },

  feedback_polish: (input) => {
    const raw = input.rawText.trim();
    return {
      model: "SBI",
      polishedText: `סיטואציה, התנהגות והשפעה על בסיס: ${firstLine(raw)}`,
      sections: [
        { title: "סיטואציה", body: firstLine(raw) },
        { title: "התנהגות", body: raw },
        { title: "השפעה", body: "יש לציין את ההשפעה הנצפית ואת ההמלצה להמשך." },
      ],
    };
  },

  feedback_summary: (_input, ctx) => ({
    summary: `סיכום ${ctx.feedback.length} משובים עבור ${traineeName(ctx)}.`,
    highlights: ctx.feedback.map((f) => `${FEEDBACK_TYPE_LABELS[f.feedbackType]}: ${firstLine(f.rawText)}`),
    sourceFeedbackIds: ids(ctx.feedback),
  }),

  trainee_review: (_input, ctx) => {
    const f = ctx.feedback;
    return {
      summary: `סקירה מבוססת ${f.length} משובים עבור ${traineeName(ctx)}.`,
      strengths: f.slice(0, 2).map((x) => firstLine(x.rawText)).filter(Boolean),
      gaps: f.slice(-2).map((x) => firstLine(x.rawText)).filter(Boolean),
      keep: f.filter((x) => x.feedbackType === "lesson").map((x) => firstLine(x.rawText)).filter(Boolean),
      improve: f.filter((x) => x.selectedAction).map((x) => x.selectedAction as string),
      patterns: [],
      sourceFeedbackIds: ids(f),
    };
  },

  development_timeline: (_input, ctx) => {
    const f = ctx.feedback; // already chronological (context builder sorts)
    return {
      points: f.map((x, i) => ({
        at: x.createdAt,
        title: `${FEEDBACK_TYPE_LABELS[x.feedbackType]}`,
        kind: i === 0 ? "start" : i === f.length - 1 ? "open" : "event",
        detail: firstLine(x.rawText),
        sourceFeedbackIds: [x.id],
      })),
      sourceFeedbackIds: ids(f),
    };
  },

  next_focus: (_input, ctx) => {
    const latest = ctx.feedback[ctx.feedback.length - 1];
    return {
      focus: latest ? `המשך עבודה על: ${firstLine(latest.rawText)}` : "אין עדיין משובים לגזור מהם מוקד.",
      rationale: `מבוסס על ${ctx.feedback.length} משובים מסומנים.`,
      recommendations: latest ? ["לתרגל בסימולציה ממוקדת", "לחזור על המשוב בשיחה הבאה"] : [],
      sourceFeedbackIds: ids(ctx.feedback),
    };
  },

  final_evaluation: (_input, ctx) => {
    const f = ctx.feedback;
    const has = f.length > 0;
    return {
      overallEvaluation: has
        ? `(תצוגת פיתוח) טיוטת סיכום תפקוד עבור ${traineeName(ctx)} על בסיס ${f.length} משובים מסומנים.`
        : `אין מספיק מידע לניסוח טיוטת חוות דעת עבור ${traineeName(ctx)}.`,
      commandAndInstructionReadiness: {
        recommendation: has ? "needs_review" : "insufficient_information",
        reasoning: has
          ? "טיוטה מבוססת מקורות; נדרשת הכרעה אנושית לפני קביעת כשירות."
          : "אין מקורות מספיקים להמלצה.",
      },
      commanderNotes: f
        .filter((x) => x.selectedAction)
        .map((x) => `מומלץ לחזק בעקבות: ${x.selectedAction as string}`),
      evidenceGaps: has ? [] : ["אין מספיק מידע על אף אחד מתחומי חוות הדעת."],
      sourceFeedbackIds: ids(f),
    };
  },

  // The aggregated review — one deterministic product covering all six sections.
  trainee_overview: (_input, ctx) => {
    const f = ctx.feedback; // already chronological (context builder sorts)
    const has = f.length > 0;
    const enoughForTrend = f.length >= 3;
    return {
      snapshot: has
        ? `(תצוגת פיתוח) תמונת מצב עבור ${traineeName(ctx)} על בסיס ${f.length} משובים מסומנים.`
        : `אין עדיין משובים מסומנים לגיבוש סקירה עבור ${traineeName(ctx)}.`,
      trends: enoughForTrend ? ["מגמת יציבות על בסיס מספר משובים כרונולוגיים."] : [],
      strengths: f.slice(0, 2).map((x) => firstLine(x.rawText)).filter(Boolean),
      gaps: f.slice(-2).map((x) => firstLine(x.rawText)).filter(Boolean),
      focus: f.filter((x) => x.selectedAction).map((x) => x.selectedAction as string),
      timeline: {
        points: f.map((x, i) => ({
          at: x.createdAt,
          title: FEEDBACK_TYPE_LABELS[x.feedbackType],
          kind: i === 0 ? "start" : i === f.length - 1 ? "open" : "event",
          detail: firstLine(x.rawText),
          sourceFeedbackIds: [x.id],
        })),
      },
      finalEvaluation: {
        overallEvaluation: has
          ? `(תצוגת פיתוח) טיוטת סיכום תפקוד עבור ${traineeName(ctx)}.`
          : `אין מספיק מידע לטיוטת חוות דעת עבור ${traineeName(ctx)}.`,
        readiness: {
          recommendation: has ? "needs_review" : "insufficient_information",
          reasoning: has
            ? "טיוטה מבוססת מקורות; נדרשת הכרעה אנושית לפני קביעת כשירות."
            : "אין מקורות מספיקים להמלצה.",
        },
        commanderNotes: f
          .filter((x) => x.selectedAction)
          .map((x) => `מומלץ לחזק בעקבות: ${x.selectedAction as string}`),
        evidenceGaps: has ? [] : ["אין מספיק מידע על אף אחד מתחומי חוות הדעת."],
      },
      sourceFeedbackIds: ids(f),
    };
  },

  // Import extraction — a deterministic best-effort read of the document's first lines.
  trainee_file_extract: (input) => {
    const lines = input.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const fullName = lines[0] ?? null;
    const missing: string[] = [];
    if (!fullName) missing.push("fullName");
    return {
      fullName,
      team: null,
      strengths: [],
      weaknesses: [],
      notes: lines.slice(1).join("\n") || null,
      suggestedCohortName: null,
      missingFields: missing,
    };
  },
};

export const mockProvider = defineStructuredProvider("mock", "mock-deterministic-v0", handlers);
