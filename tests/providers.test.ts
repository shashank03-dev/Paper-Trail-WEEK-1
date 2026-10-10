import { afterEach, describe, expect, it, vi } from "vitest";
import { endpointLabel, isHosted, llmConfig, providerIds } from "@/lib/config";
import { adaptMessages } from "@/lib/llm/client";

const KEYS = [
  "LLM_PROVIDER",
  "GEMINI_API_KEY",
  "OLLAMA_API_KEY",
  "LLM_BASE_URL",
  "LLM_MODEL_TEXT",
  "GEMINI_MODEL_TEXT",
  "LLM_API_KEY",
];
afterEach(() => vi.unstubAllEnvs());
const clean = () => KEYS.forEach((k) => vi.stubEnv(k, ""));

describe("provider selection", () => {
  it("defaults to local Ollama with Gemma 4 E4B", () => {
    clean();
    const c = llmConfig();
    expect(providerIds()).toEqual(["ollama"]);
    expect(c.baseURL).toBe("http://localhost:11434/v1");
    expect(c.modelText).toBe("gemma4:e4b");
    expect(isHosted(c)).toBe(false);
  });

  it("picks hosted providers from the keys that are set, Gemma by default", () => {
    clean();
    vi.stubEnv("GEMINI_API_KEY", "g-key");
    vi.stubEnv("OLLAMA_API_KEY", "o-key");
    const c = llmConfig();
    expect(c.providers.map((p) => p.id)).toEqual(["gemini", "ollama-cloud"]);
    expect(c.providers[0]).toMatchObject({
      apiKey: "g-key",
      modelText: "gemma-4-26b-a4b-it",
      jsonSchema: false,
      systemRole: false,
      hosted: true,
    });
    expect(c.providers[1]).toMatchObject({
      apiKey: "o-key",
      baseURL: "https://ollama.com/v1",
      modelText: "gemma4:31b",
    });
    expect(endpointLabel(c.baseURL)).toBe("the Gemini API");
  });

  it("honours an explicit chain and per-provider model overrides", () => {
    clean();
    vi.stubEnv("LLM_PROVIDER", "ollama-cloud, gemini");
    vi.stubEnv("OLLAMA_API_KEY", "o");
    vi.stubEnv("GEMINI_MODEL_TEXT", "gemma-4-31b-it");
    const c = llmConfig();
    expect(c.providers.map((p) => p.id)).toEqual(["ollama-cloud", "gemini"]);
    expect(c.providers[1]!.modelText).toBe("gemma-4-31b-it");
  });

  it("ignores local-only LLM_* vars for hosted providers", () => {
    clean();
    vi.stubEnv("LLM_PROVIDER", "gemini,ollama");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("LLM_BASE_URL", "http://ollama:11434/v1");
    vi.stubEnv("LLM_MODEL_TEXT", "gemma4:e4b");
    const c = llmConfig();
    expect(c.providers[0]).toMatchObject({
      id: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      modelText: "gemma-4-26b-a4b-it",
    });
    expect(c.providers[1]).toMatchObject({
      id: "ollama",
      baseURL: "http://ollama:11434/v1",
      modelText: "gemma4:e4b",
    });
  });

  it("treats a Docker-network Ollama as local, not hosted", () => {
    clean();
    vi.stubEnv("LLM_BASE_URL", "http://papertrail-ollama:11434/v1");
    expect(isHosted(llmConfig())).toBe(false);
  });

  it("lets the browser switch models but not the endpoint unless allowed", () => {
    clean();
    const h = new Headers({
      "x-pt-model-text": "gemma4:e2b",
      "x-pt-llm-base": "http://evil.example/v1",
    });
    const c = llmConfig(h);
    expect(c.modelText).toBe("gemma4:e2b");
    expect(c.baseURL).toBe("http://localhost:11434/v1");
  });
});

describe("message adaptation (e.g. Gemma on the Gemini API)", () => {
  const req = {
    model: "m",
    messages: [
      { role: "system" as const, content: "You are the writer." },
      { role: "user" as const, content: "TASK: plan" },
    ],
    schema: { name: "x", schema: { type: "object", properties: { a: { type: "string" } } } },
  };
  it("folds the system prompt into the user turn and puts the schema in the prompt", () => {
    const m = adaptMessages(req, { jsonSchema: false, systemRole: false });
    expect(m).toHaveLength(1);
    expect(m[0]!.role).toBe("user");
    expect(m[0]!.content as string).toMatch(/^You are the writer\.\n\nTASK: plan/);
    expect(m[0]!.content as string).toContain('"properties"');
  });
  it("leaves capable providers alone", () => {
    expect(adaptMessages(req, { jsonSchema: true, systemRole: true })).toEqual(req.messages);
  });
  it("keeps image parts when adapting a vision call", () => {
    const m = adaptMessages(
      {
        ...req,
        messages: [
          req.messages[0]!,
          {
            role: "user",
            content: [
              { type: "text", text: "TASK: read-ispy" },
              { type: "image_url", image_url: { url: "data:x" } },
            ],
          },
        ],
      },
      { jsonSchema: false, systemRole: false },
    );
    const parts = m[0]!.content as { type: string }[];
    expect(parts.map((p) => p.type)).toEqual(["text", "text", "image_url", "text"]);
  });
});

describe("provider chain", () => {
  it("falls through to the next provider when the first is down", async () => {
    const { createServer } = await import("node:http");
    const { createChat } = await import("@/lib/llm/client");
    const seen: string[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push(JSON.parse(body).model);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: "x",
            object: "chat.completion",
            created: 0,
            model: "m",
            choices: [
              { index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
            ],
          }),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = (server.address() as { port: number }).port;
    const base = {
      apiKey: "k",
      jsonSchema: true,
      systemRole: true,
      native: false,
      hosted: true,
      label: "x",
    };
    const chat = createChat({
      providers: [
        {
          ...base,
          id: "openai-compat",
          baseURL: "http://127.0.0.1:9/v1",
          modelText: "primary-model",
          modelVision: "primary-vision",
        },
        {
          ...base,
          id: "gemini",
          baseURL: `http://127.0.0.1:${port}/v1`,
          modelText: "backup-model",
          modelVision: "backup-vision",
        },
      ],
      baseURL: "http://127.0.0.1:9/v1",
      modelText: "primary-model",
      modelVision: "primary-vision",
      timeoutMs: 3000,
    });
    const r = await chat({ model: "primary-vision", messages: [{ role: "user", content: "hi" }] });
    server.close();
    expect(r.content).toBe("ok");
    expect(seen).toEqual(["backup-vision"]);
  });
});
