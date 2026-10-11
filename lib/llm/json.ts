import { z } from "zod";
import type { Chat, ChatMessage, ChatOptions } from "./types";
import { approxTokens } from "./client";

export class LlmJsonError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public problems: string[],
  ) {
    super(message);
  }
}

export interface JsonCallResult<T> {
  value: T;
  attempts: number;
  /** "llm" on the first try, "llm-retry" after a corrective retry. */
  path: "llm" | "llm-retry";
  ms: number;
  tokens: number;
  /** Problems that were fixed along the way (for logs and evals). */
  fixed: string[];
}

export interface JsonCallSpec<T> {
  chat: Chat;
  model: string;
  name: string;
  system: string;
  user: ChatMessage["content"];
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  /** Extra semantic checks (grounding, fit). Return problems; empty = OK. */
  validate?: (value: T) => string[];
  /** A deterministic fix applied to every parsed value before `validate`. */
  repair?: (value: T) => T;
  retries?: number;
  opts?: ChatOptions;
}

/** Ollama/Gemma sometimes wrap JSON in fences or add a preamble. */
export function extractJson(text: string): unknown {
  const t = text.trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : t;
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error("no JSON object in response");
  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  return JSON.parse(body.slice(start, end + 1));
}

export function jsonSchemaFor(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/**
 * Structured call with a validation loop: JSON schema in response_format →
 * parse → zod → semantic checks → retry with the exact error appended.
 * Throws LlmJsonError when retries are exhausted; callers then fall back.
 */
export async function chatJSON<T>(spec: JsonCallSpec<T>): Promise<JsonCallResult<T>> {
  const retries = spec.retries ?? 2;
  const messages: ChatMessage[] = [
    { role: "system", content: spec.system },
    { role: "user", content: spec.user },
  ];
  const jsonSchema = jsonSchemaFor(spec.schema);
  let lastProblems: string[] = [];
  const fixed: string[] = [];
  let ms = 0;
  let tokens = 0;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const res = await spec.chat(
      {
        model: spec.model,
        messages,
        schema: { name: spec.name, schema: jsonSchema },
        temperature: spec.temperature,
        maxTokens: spec.maxTokens,
      },
      spec.opts,
    );
    ms += res.ms;
    tokens += res.completionTokens ?? approxTokens(res.content);
    let problems: string[] = [];
    let value: T | undefined;
    try {
      const raw = extractJson(res.content);
      const parsed = spec.schema.safeParse(raw);
      if (!parsed.success) {
        problems = parsed.error.issues
          .slice(0, 6)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
      } else {
        value = spec.repair ? spec.repair(parsed.data) : parsed.data;
        problems = spec.validate?.(value) ?? [];
      }
    } catch (e) {
      problems = [`not valid JSON (${(e as Error).message.slice(0, 80)})`];
    }
    if (problems.length === 0 && value !== undefined) {
      return {
        value,
        attempts: attempt,
        path: attempt === 1 ? "llm" : "llm-retry",
        ms,
        tokens,
        fixed,
      };
    }
    lastProblems = problems;
    fixed.push(...problems);
    messages.push({ role: "assistant", content: res.content.slice(0, 4000) });
    messages.push({
      role: "user",
      content: `Your last JSON failed: ${problems.join("; ")}. Fix exactly these problems. Return only valid JSON that matches the schema.`,
    });
  }
  throw new LlmJsonError(
    `${spec.name}: gave up after ${retries + 1} attempts`,
    retries + 1,
    lastProblems,
  );
}
