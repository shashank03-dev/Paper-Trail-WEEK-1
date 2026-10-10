import OpenAI from "openai";
import type { LlmConfig } from "@/lib/config";
import type { Chat, ChatRequest, ChatResult } from "./types";

/**
 * The only way Paper Trail talks to a model: an OpenAI-compatible endpoint of
 * an open-weights model (default: local Ollama serving Gemma 4).
 */
export function createChat(cfg: LlmConfig): Chat {
  if (cfg.native) return createNativeOllamaChat(cfg);
  const client = new OpenAI({
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
    timeout: cfg.timeoutMs,
    maxRetries: 0,
  });
  return async (req, opts) => {
    const t0 = Date.now();
    const body = {
      model: req.model,
      messages: req.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: req.temperature ?? 0.7,
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
      ...(req.schema
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
        { ...body, stream: true, stream_options: { include_usage: true } },
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
}

/** Ollama's native /api/chat with `format: <schema>`, behind LLM_OLLAMA_NATIVE=true. */
function createNativeOllamaChat(cfg: LlmConfig): Chat {
  const root = cfg.baseURL.replace(/\/v1\/?$/, "");
  return async (req: ChatRequest, opts): Promise<ChatResult> => {
    const t0 = Date.now();
    const messages = req.messages.map((m) => {
      if (typeof m.content === "string") return { role: m.role, content: m.content };
      const text = m.content
        .filter((p) => p.type === "text")
        .map((p) => (p as { text: string }).text)
        .join("\n");
      const images = m.content
        .filter((p) => p.type === "image_url")
        .map((p) =>
          (p as { image_url: { url: string } }).image_url.url.replace(/^data:[^,]+,/, ""),
        );
      return { role: m.role, content: text, images };
    });
    const res = await fetch(`${root}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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
      signal: opts?.signal ?? AbortSignal.timeout(cfg.timeoutMs),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}`);
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
