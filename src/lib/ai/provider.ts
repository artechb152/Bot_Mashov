/**
 * חונך+ AI layer — the provider contract (Stage 0).
 *
 * Every AI backend (the deterministic dev Mock, and a FUTURE real provider —
 * OpenAI/Minimax/other) implements this one interface. Swapping providers must
 * require ZERO changes to the UI, the routes, or the callers — only the factory
 * in `./index` picks which implementation to return. Pure — no DB/HTTP/DOM.
 */
import { computeContextHash } from "./context";
import type { AIContext, AIResult, AITask, AITaskInput, AITaskOutput } from "./types";

export interface AIProvider {
  readonly name: string;
  run<T extends AITask>(
    task: T,
    input: AITaskInput<T>,
    context: AIContext,
  ): Promise<AIResult<AITaskOutput<T>>>;
}

/** A synchronous per-task handler: authorized context in, structured output out. */
export type TaskHandlers = {
  [K in AITask]: (input: AITaskInput<K>, context: AIContext) => AITaskOutput<K>;
};

/**
 * Build a provider from a record of pure task handlers. Wraps each output in an
 * "ok" envelope stamped with the provider name + the context fingerprint. The
 * generic `run` narrows per task; the single internal cast is localised here.
 */
export function defineStructuredProvider(name: string, model: string, handlers: TaskHandlers): AIProvider {
  return {
    name,
    async run(task, input, context) {
      const handler = handlers[task] as (i: unknown, c: AIContext) => unknown;
      const output = handler(input, context) as AITaskOutput<typeof task>;
      return {
        status: "ok",
        task,
        output,
        provider: name,
        model,
        contextHash: computeContextHash(context),
      };
    },
  };
}
