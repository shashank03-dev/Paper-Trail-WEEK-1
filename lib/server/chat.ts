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
export const gateStats = () => ({ ...gate.stats(), budget: budget.stats() });

/**
 * A daily ceiling on model calls for this server, so a traffic spike (or a
 * script) can't run up the provider bill. Past it, calls fail fast with
 * BudgetError and every caller degrades the way it already does when the model
 * is down: template pages for the writer, the tick-counter for the reader.
 * LLM_DAILY_CALL_BUDGET=off disables it; 0 stops all model calls (kill switch).
 */
export class BudgetError extends Error {
  constructor() {
    super("Today's model budget is used up; using the built-in template instead.");
  }
}
export function createBudget(setting = process.env.LLM_DAILY_CALL_BUDGET ?? "") {
  const raw = setting.trim().toLowerCase();
  const n = Number(raw);
  // A typo falls back to the default rather than silently switching the model off.
  const limit =
    raw === "off" ? Infinity : raw === "" || !Number.isFinite(n) ? 2000 : Math.max(0, n);
  let day = "";
  let used = 0;
  const today = () => new Date().toISOString().slice(0, 10);
  return {
    take(): void {
      if (day !== today()) {
        day = today();
        used = 0;
      }
      if (used >= limit) throw new BudgetError();
      used++;
    },
    stats: () => ({
      used: day === today() ? used : 0,
      limit: Number.isFinite(limit) ? limit : null,
    }),
  };
}
const budget = createBudget();

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
      budget.take();
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
