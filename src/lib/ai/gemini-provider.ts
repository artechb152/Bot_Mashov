/**
 * חונך+ AI layer — the Google Gemini provider (drop-in for {@link AIProvider}).
 *
 * Calls the Gemini REST API (`generateContent`) directly with `fetch` — no SDK
 * dependency. Prompt assembly is shared with the OpenAI provider (same hierarchy:
 * system → safety → knowledge → task; data kept separate), so answers are grounded in
 * the same authorized context. Structured tasks request JSON and are STILL
 * re-validated by `runAITask`. The model name comes from the caller (GEMINI_MODEL).
 * The API key is sent in a header, never logged, returned, or persisted.
 *
 * Server-only.
 */
import { computeContextHash } from "./context";
import { AI_LIMITS } from "./config";
import { isStructuredTask, taskJsonSchema } from "./json-schemas";
import { buildContextData, buildInput, buildInstructions } from "./openai-provider";
import type { AIProvider } from "./provider";
import type {
  AIContext,
  AIErrorCategory,
  AIResult,
  AITask,
  AITaskInput,
  AITaskOutput,
  ChatInput,
  TraineeFileExtractInput,
} from "./types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
};

/** Minimal fetch seam — lets tests inject a fake instead of hitting the network. */
export type GeminiFetch = (url: string, init: RequestInit) => Promise<Response>;

type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };

/**
 * Chat as a NATIVE multi-turn conversation (Gemini `contents` history), not one
 * flattened prompt: the trainee data opens the conversation as a user turn the model
 * acknowledges, followed by the real history and the current message. Consecutive
 * same-role turns (e.g. a user message whose answer failed) are merged, since Gemini
 * expects user/model alternation.
 */
function buildChatContents(input: ChatInput, context: AIContext): GeminiContent[] {
  const messages = input.messages ?? [];
  const recent = [...messages.slice(0, -1).slice(-AI_LIMITS.maxHistoryTurns), ...messages.slice(-1)];
  const turns: GeminiContent[] = [
    { role: "user", parts: [{ text: buildContextData(context) }] },
    { role: "model", parts: [{ text: "קיבלתי את נתוני החניך והמשובים. אענה על בסיסם ועל הידע המקצועי בלבד." }] },
    ...recent.map((m): GeminiContent => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  ];
  return turns.reduce<GeminiContent[]>((acc, t) => {
    const last = acc[acc.length - 1];
    if (last && last.role === t.role) last.parts[0].text += "\n\n" + t.parts[0].text;
    else acc.push({ role: t.role, parts: [{ text: t.parts[0].text }] });
    return acc;
  }, []);
}

function categorize(status: number | undefined, err: unknown): { category: AIErrorCategory; message: string } {
  if (status === 401 || status === 403 || status === 400) {
    // Gemini reports an invalid key as 400 (API_KEY_INVALID) or 403.
    return { category: "authentication_error", message: "אימות מול ספק ה-AI נכשל." };
  }
  if (status === 429) return { category: "rate_limited", message: "יותר מדי בקשות לספק ה-AI. נסו שוב בעוד רגע." };
  const name = (err as { name?: string })?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError") {
    return { category: "timeout", message: "הבקשה לספק ה-AI חרגה מהזמן המוקצב." };
  }
  return { category: "provider_error", message: "אירעה שגיאה מול ספק ה-AI." };
}

export function createGeminiProvider(opts: {
  apiKey: string;
  model: string;
  /** Injected in tests; defaults to global fetch. */
  fetch?: GeminiFetch;
}): AIProvider {
  const { apiKey, model } = opts;
  const doFetch: GeminiFetch = opts.fetch ?? ((url, init) => fetch(url, init));

  return {
    name: "gemini",
    async run<T extends AITask>(
      task: T,
      input: AITaskInput<T>,
      context: AIContext,
    ): Promise<AIResult<AITaskOutput<T>>> {
      const err = (category: AIErrorCategory, message: string): AIResult<AITaskOutput<T>> => ({
        status: "error",
        task,
        provider: "gemini",
        message,
        category,
      });

      // --- Limit checks (no silent truncation) ---
      if (context.feedback.length > AI_LIMITS.maxFeedbackItems) {
        return err("context_too_large", "נבחרו יותר מדי משובים. צמצמו את הבחירה ונסו שוב.");
      }
      if (task === "chat") {
        const msgs = (input as ChatInput).messages ?? [];
        const current = msgs[msgs.length - 1];
        if ((current?.content?.length ?? 0) > AI_LIMITS.maxUserMessageChars) {
          return err("input_too_large", "ההודעה ארוכה מדי. קצרו אותה ונסו שוב.");
        }
      }
      if (task === "trainee_file_extract") {
        const len = (input as TraineeFileExtractInput).text?.length ?? 0;
        if (len === 0) return err("invalid_output", "לא נמצא טקסט לחילוץ מהמסמך.");
        if (len > AI_LIMITS.maxExtractionChars) {
          return err("input_too_large", "המסמך ארוך מדי לחילוץ אוטומטי. הזינו את הפרטים ידנית.");
        }
      }

      const instructions = buildInstructions(task, context);
      const promptInput = buildInput(task, input, context);
      if (instructions.length + promptInput.length > AI_LIMITS.maxContextChars) {
        return err("context_too_large", "ההקשר גדול מדי לעיבוד. צמצמו את מספר המשובים המסומנים ונסו שוב.");
      }

      const generationConfig: Record<string, unknown> = {
        maxOutputTokens: AI_LIMITS.maxOutputTokens[task],
      };
      if (isStructuredTask(task)) {
        generationConfig.responseMimeType = "application/json";
        generationConfig.responseJsonSchema = taskJsonSchema(task);
      }

      const started = Date.now();
      let status: number | undefined;
      try {
        const body = JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents:
            task === "chat"
              ? buildChatContents(input as ChatInput, context)
              : [{ role: "user", parts: [{ text: promptInput }] }],
          generationConfig,
        });
        // One shared deadline across retries; retry only transient overload (429/503).
        const signal = AbortSignal.timeout(AI_LIMITS.requestTimeoutMs);
        let res: Response;
        for (let attempt = 0; ; attempt++) {
          res = await doFetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body,
            signal,
          });
          if ((res.status !== 429 && res.status !== 503) || attempt >= AI_LIMITS.maxRetries) break;
          await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
        }
        status = res.status;
        if (!res.ok) throw new Error(`gemini http ${res.status}`);

        const data = (await res.json()) as GeminiResponse;
        const text = (data.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        const u = data.usageMetadata;
        const usage = u
          ? { inputTokens: u.promptTokenCount, outputTokens: u.candidatesTokenCount, totalTokens: u.totalTokenCount }
          : undefined;

        if (task === "chat") {
          if (!text) return err("invalid_output", "התקבלה תשובה ריקה מספק ה-AI.");
          return {
            status: "ok",
            task,
            output: { reply: text } as AITaskOutput<T>,
            provider: "gemini",
            model,
            contextHash: computeContextHash(context),
            usage,
          };
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return err("invalid_output", "פלט ה-AI אינו JSON תקין.");
        }
        return {
          status: "ok",
          task,
          output: parsed as AITaskOutput<T>,
          provider: "gemini",
          model,
          contextHash: computeContextHash(context),
          usage,
        };
      } catch (error) {
        const { category, message } = categorize(status, error);
        // Safe log ONLY: no api key, no full context, no raw response.
        console.error("[ai/gemini] call failed:", {
          task,
          provider: "gemini",
          model,
          category,
          httpStatus: status,
          durationMs: Date.now() - started,
        });
        return err(category, message);
      }
    },
  };
}
