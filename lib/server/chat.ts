import { llmConfig, serverConfig, type LlmConfig } from "@/lib/config";
import { createChat } from "@/lib/llm/client";
import type { Chat, ChatRequest } from "@/lib/llm/types";
import { replayContent } from "./fixtures";

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
 */
export async function chatFor(
  headers: Headers,
  presetId?: string,
): Promise<{ chat: Chat; mode: "live" | "replay"; cfg: LlmConfig }> {
  const cfg = llmConfig(headers);
  const live = createChat(cfg);
  if (!serverConfig().demoMode || (await endpointUp(cfg))) return { chat: live, mode: "live", cfg };
  const replay: Chat = async (req, opts) => {
    const content = presetId ? await replayContent(presetId, taskOf(req)) : null;
    if (!content) throw new Error("no recorded response for this request (demo replay)");
    opts?.onDelta?.(content);
    return { content, ms: 0, completionTokens: Math.round(content.length / 3.6) };
  };
  return { chat: replay, mode: "replay", cfg };
}
