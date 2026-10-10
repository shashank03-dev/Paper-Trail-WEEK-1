/**
 * A tiny OpenAI-compatible server that answers like Gemma would, for tests,
 * e2e and evals without a GPU. NOT a real model: see lib/llm/mock.ts.
 *   pnpm mock:llm            # http://127.0.0.1:11435/v1
 */
import { createServer } from "node:http";
import { mockContent } from "@/lib/llm/mock";
import type { ChatRequest } from "@/lib/llm/types";

const PORT = Number(process.env.MOCK_LLM_PORT ?? 11435);
const DELAY = Number(process.env.MOCK_LLM_DELAY_MS ?? 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  const send = (code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && (req.url === "/v1/models" || req.url === "/api/tags"))
    return send(200, {
      object: "list",
      data: [
        { id: "gemma4:e4b", object: "model" },
        { id: "gemma4:e2b", object: "model" },
      ],
    });
  if (req.method === "POST" && req.url === "/v1/chat/completions") {
    const body = JSON.parse(raw) as ChatRequest & { stream?: boolean; max_tokens?: number };
    const content = mockContent(body);
    const usage = {
      prompt_tokens: Math.round(raw.length / 4),
      completion_tokens: Math.round(content.length / 3.6),
      total_tokens: 0,
    };
    if (!body.stream) {
      if (DELAY) await sleep(DELAY * 10);
      return send(200, {
        id: "mock",
        object: "chat.completion",
        created: Date.now() / 1000,
        model: body.model,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage,
      });
    }
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    for (let i = 0; i < content.length; i += 12) {
      res.write(
        `data: ${JSON.stringify({ id: "mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: { content: content.slice(i, i + 12) }, finish_reason: null }] })}\n\n`,
      );
      if (DELAY) await sleep(DELAY);
    }
    res.write(
      `data: ${JSON.stringify({ id: "mock", object: "chat.completion.chunk", model: body.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage })}\n\n`,
    );
    res.end("data: [DONE]\n\n");
    return;
  }
  if (req.method === "POST" && req.url === "/api/chat") {
    const body = JSON.parse(raw) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    const content = mockContent({
      model: body.model,
      messages: body.messages as ChatRequest["messages"],
    });
    return send(200, {
      model: body.model,
      message: { role: "assistant", content },
      done: true,
      eval_count: Math.round(content.length / 3.6),
    });
  }
  send(404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`mock LLM (NOT a real model) on http://127.0.0.1:${PORT}/v1`),
);
