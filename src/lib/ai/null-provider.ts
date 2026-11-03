/**
 * חונך+ AI layer — Null Provider (Stage 0).
 *
 * The DEFAULT when no AI provider is configured (production, until a real provider
 * is wired). It never fabricates a result: every task returns a "not_configured"
 * envelope, which the UI renders as "AI לא מחובר עדיין" — never a fake answer
 * presented as real. Pure — no DB/HTTP/DOM.
 */
import type { AIProvider } from "./provider";

const NOT_CONFIGURED_MESSAGE = "שכבת ה-AI מוכנה אך לא חובר עדיין ספק. התכונה תופעל בשלב הבא.";

export const nullProvider: AIProvider = {
  name: "null",
  async run(task) {
    return { status: "not_configured", task, provider: "null", message: NOT_CONFIGURED_MESSAGE };
  },
};
