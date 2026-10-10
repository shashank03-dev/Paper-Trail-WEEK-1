import { llmConfig, serverConfig, type LlmConfig } from "@/lib/config";
import { createChat } from "@/lib/llm/client";
import type { Chat, ChatRequest } from "@/lib/llm/types";
import { replayContent } from "./fixtures";
import { createGate } from "./gate";

const intEnv = (k: string, d: number) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && n > 0 ? n : d;
};
/** Every model call on this server goes through one gate (see gate.ts). */
const gate = createGate(intEnv("LLM_MAX_CONCURRENCY", 4), intEnv("LLM_QUEUE_TIMEOUT_MS", 30_000));
export const gateStats = () => gate.stats();

/** What one request spent on the model, for its log line. */
export interface Usage {
  calls: number;
  ms: number;
  providers: string[];
}

let lastProbe: { at: number; ok: boolean; key: string } | null = null;

/** Is the model endpoint answering? Cached for 20 s. */
export async function endpointUp(cfg: LlmConfig): Promise<boolean> {
  const p = cfg.providers[0]!;
  const key = p.baseURL;
  if (lastProbe && lastProbe.key === key && Date.now() - lastProbe.at < 20_000) return lastProbe.ok;
  let ok = false;
  try {
    const res = await fetch(`${p.baseURL.replace(/\/$/, "")}/models`, {
      headers: { authorization: `Bearer ${p.apiKey}` },
      signal: AbortSignal.timeout(2500),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  lastProbe = { at: Date.now(), ok, key };
  return ok;
}

function taskOf(req: ChatRequest): string {
  const u = req.messages.find((m) => m.role === "user");
  const text =
    typeof u?.content === "string"
      ? u.content
      : ((u?.content.find((p) => p.type === "text") as { text: string } | undefined)?.text ?? "");
  return text.match(/^TASK: ([\w-]+)/m)?.[1] ?? "chat";
}

/**
 * The chat function for a request. Live by default; in DEMO_MODE with the
 * endpoint down it replays recorded Gemma output for the preset (and says so).
 * Live calls are queued through the gate and cancelled with `signal`.
 */
export async function chatFor(
  headers: Headers,
  presetId?: string,
  signal?: AbortSignal,
): Promise<{ chat: Chat; mode: "live" | "replay"; cfg: LlmConfig; usage: Usage }> {
  const cfg = llmConfig(headers);
  const usage: Usage = { calls: 0, ms: 0, providers: [] };
  const base = createChat(cfg);
  const live: Chat = (req, opts) =>
    gate.run(async () => {
      const r = await base(req, { ...opts, signal: opts?.signal ?? signal });
      usage.calls++;
      usage.ms += r.ms;
      if (r.provider && !usage.providers.includes(r.provider)) usage.providers.push(r.provider);
      return r;
    }, signal);
  if (!serverConfig().demoMode || (await endpointUp(cfg)))
    return { chat: live, mode: "live", cfg, usage };
  const replay: Chat = async (req, opts) => {
    const content = presetId ? await replayContent(presetId, taskOf(req)) : null;
    if (!content) throw new Error("no recorded response for this request (demo replay)");
    opts?.onDelta?.(content);
    usage.calls++;
    return { content, ms: 0, completionTokens: Math.round(content.length / 3.6) };
  };
  return { chat: replay, mode: "replay", cfg, usage };
}
