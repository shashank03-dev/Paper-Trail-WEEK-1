import OpenAI from "openai";
import type { LlmConfig, ProviderConfig } from "@/lib/config";
import type { Chat, ChatMessage, ChatRequest, ChatResult } from "./types";

/**
 * The only way Paper Trail talks to a model: OpenAI-compatible endpoints
 * serving Gemma (local Ollama, Ollama Cloud, or Google's Gemini API).
 * With several providers configured, the next one is tried on failure.
 */
export function createChat(cfg: LlmConfig): Chat {
  const primary = cfg.providers[0]!;
  const chats = cfg.providers.map((p) => ({ p, chat: createProviderChat(p, cfg.timeoutMs) }));
  if (chats.length === 1) return chats[0]!.chat;
  return async (req, opts) => {
    let last: unknown;
    for (const { p, chat } of chats) {
      // Callers name the primary's models; map them onto this provider's.
      const model =
        req.model === primary.modelVision
          ? p.modelVision
          : req.model === primary.modelText
            ? p.modelText
            : req.model;
      try {
        return await chat({ ...req, model }, opts);
      } catch (e) {
        last = e;
        if (opts?.signal?.aborted || !retryable(e)) throw e;
      }
    }
    throw last;
  };
}

/** Network errors, timeouts, rate limits and 5xx move on to the next provider. */
function retryable(e: unknown): boolean {
  const status = (e as { status?: number }).status;
  if (status === undefined) return true;
  return (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    status === 401 ||
    status === 403 ||
    status === 404
  );
}

/** For providers without structured output or a system role (e.g. Gemma on the Gemini API). */
export function adaptMessages(
  req: ChatRequest,
  p: Pick<ProviderConfig, "jsonSchema" | "systemRole">,
): ChatMessage[] {
  let messages = req.messages;
  if (req.schema && !p.jsonSchema) {
    const hint = `\n\nReply with ONLY a JSON object (no prose, no code fences) that matches this JSON Schema:\n${JSON.stringify(req.schema.schema)}`;
    const i = messages.findIndex((m) => m.role === "user");
    messages = messages.map((m, j) => {
      if (j !== i) return m;
      if (typeof m.content === "string") return { ...m, content: m.content + hint };
      return { ...m, content: [...m.content.map((c) => c), { type: "text" as const, text: hint }] };
    });
  }
  if (!p.systemRole) {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content as string)
      .join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    if (system) {
      const first = rest.findIndex((m) => m.role === "user");
      messages = rest.map((m, j) => {
        if (j !== first) return m;
        if (typeof m.content === "string") return { ...m, content: `${system}\n\n${m.content}` };
        return { ...m, content: [{ type: "text" as const, text: system }, ...m.content] };
      });
    } else messages = rest;
  }
  return messages;
}

function createProviderChat(p: ProviderConfig, timeoutMs: number): Chat {
  if (p.native) return createNativeOllamaChat(p, timeoutMs);
  const client = new OpenAI({
    baseURL: p.baseURL,
    apiKey: p.apiKey || "none",
    timeout: timeoutMs,
    maxRetries: 0,
  });
  // Some endpoints reject response_format; learn that once and put the schema in the prompt.
  let jsonSchema = p.jsonSchema;
  const run = async (
    req: ChatRequest,
    opts: Parameters<Chat>[1],
    useSchema: boolean,
  ): Promise<ChatResult> => {
    const t0 = Date.now();
    const body = {
      model: req.model,
      messages: adaptMessages(req, {
        jsonSchema: useSchema,
        systemRole: p.systemRole,
      }) as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: req.temperature ?? 0.7,
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
      ...(req.schema && useSchema
        ? {
            response_format: {
              type: "json_schema" as const,
              json_schema: { name: req.schema.name, schema: req.schema.schema, strict: true },
            },
          }
        : {}),
    };
    if (opts?.onDelta) {
      const stream = await client.chat.completions.create(
        {
          ...body,
          stream: true,
          ...(p.id === "gemini" ? {} : { stream_options: { include_usage: true } }),
        },
        { signal: opts.signal },
      );
      let content = "";
      let completionTokens: number | undefined;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          content += delta;
          opts.onDelta(delta);
        }
        if (chunk.usage?.completion_tokens) completionTokens = chunk.usage.completion_tokens;
      }
      return { content, ms: Date.now() - t0, completionTokens };
    }
    const res = await client.chat.completions.create(body, { signal: opts?.signal });
    return {
      content: res.choices[0]?.message?.content ?? "",
      ms: Date.now() - t0,
      completionTokens: res.usage?.completion_tokens,
    };
  };
  return async (req, opts) => {
    try {
      return await run(req, opts, jsonSchema);
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (req.schema && jsonSchema && (status === 400 || status === 422)) {
        jsonSchema = false;
        return run(req, opts, false);
      }
      throw e;
    }
  };
}

/** Ollama's native /api/chat with `format: <schema>`, behind LLM_OLLAMA_NATIVE=true. */
function createNativeOllamaChat(p: ProviderConfig, timeoutMs: number): Chat {
  const root = p.baseURL.replace(/\/v1\/?$/, "");
  return async (req: ChatRequest, opts): Promise<ChatResult> => {
    const t0 = Date.now();
    const messages = req.messages.map((m) => {
      if (typeof m.content === "string") return { role: m.role, content: m.content };
      const text = m.content
        .filter((c) => c.type === "text")
        .map((c) => (c as { text: string }).text)
        .join("\n");
      const images = m.content
        .filter((c) => c.type === "image_url")
        .map((c) =>
          (c as { image_url: { url: string } }).image_url.url.replace(/^data:[^,]+,/, ""),
        );
      return { role: m.role, content: text, images };
    });
    const res = await fetch(`${root}/api/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(p.apiKey && p.apiKey !== "ollama" ? { authorization: `Bearer ${p.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: req.model,
        messages,
        stream: false,
        format: req.schema?.schema,
        options: {
          temperature: req.temperature ?? 0.7,
          ...(req.maxTokens ? { num_predict: req.maxTokens } : {}),
        },
      }),
      signal: opts?.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw Object.assign(new Error(`ollama ${res.status}`), { status: res.status });
    const j = (await res.json()) as { message?: { content?: string }; eval_count?: number };
    const content = j.message?.content ?? "";
    opts?.onDelta?.(content);
    return { content, ms: Date.now() - t0, completionTokens: j.eval_count };
  };
}

/** Rough token count when the server doesn't report usage. */
export function approxTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 3.6));
}
