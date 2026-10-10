import { NextResponse } from "next/server";
import { endpointLabel, llmConfig, serverConfig, type LlmConfig } from "@/lib/config";
import { createChat, approxTokens } from "@/lib/llm/client";
import { route } from "@/lib/server/http";
import { gateStats } from "@/lib/server/chat";

export const dynamic = "force-dynamic";

interface Health {
  ok: boolean;
  model: string;
  where: string;
  latencyMs: number;
  tokensPerSec: number | null;
  mode: "live" | "replay" | "down";
  error?: string;
}

/*
 * The model badge on every page asks for this, so a real ping per visitor would
 * spend the provider's quota on page views. Results are cached for a minute and
 * concurrent callers share one in-flight ping; `?fresh=1` (Settings → Test
 * connection) always pings.
 */
const TTL_MS = 60_000;
const memo = new Map<string, { at: number; value: Promise<Health> }>();

async function ping(cfg: LlmConfig): Promise<Health> {
  const t0 = Date.now();
  try {
    const chat = createChat({ ...cfg, timeoutMs: Math.min(cfg.timeoutMs, 60_000) });
    const r = await chat({
      model: cfg.modelText,
      messages: [{ role: "user", content: "Reply with the single word: ready" }],
      temperature: 0,
      maxTokens: 8,
    });
    const tokens = r.completionTokens ?? approxTokens(r.content);
    return {
      ok: true,
      model: cfg.modelText,
      where: endpointLabel(cfg.baseURL),
      latencyMs: Date.now() - t0,
      tokensPerSec: r.ms > 0 ? Math.round((tokens / (r.ms / 1000)) * 10) / 10 : null,
      mode: "live",
    };
  } catch (e) {
    return {
      ok: false,
      model: cfg.modelText,
      where: endpointLabel(cfg.baseURL),
      latencyMs: Date.now() - t0,
      tokensPerSec: null,
      mode: serverConfig().demoMode ? "replay" : "down",
      // Enough to diagnose from Settings, never the provider's raw message.
      error: describe(e),
    };
  }
}

function describe(e: unknown): string {
  const status = (e as { status?: number }).status;
  if (status) return `HTTP ${status}`;
  const name = (e as Error)?.name ?? "";
  return /abort|timeout/i.test(name + String((e as Error)?.message)) ? "timed out" : "unreachable";
}

/** Is the model answering? `{ ok, model, where, latencyMs, tokensPerSec, mode }`. */
export const GET = route("health", async (req, rc) => {
  const cfg = llmConfig(req.headers);
  const key = `${cfg.providers.map((p) => `${p.id}@${p.baseURL}`).join(",")}|${cfg.modelText}`;
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  let hit = memo.get(key);
  const cached = !fresh && !!hit && Date.now() - hit.at < TTL_MS;
  if (!cached) {
    hit = { at: Date.now(), value: ping(cfg) };
    memo.set(key, hit);
  }
  const h = await hit!.value;
  rc.note({ ok: h.ok, cached });
  const status = h.ok || h.mode === "replay" ? 200 : 503;
  return NextResponse.json(
    { ...h, cached, gate: gateStats() },
    { status, headers: { "cache-control": "no-store" } },
  );
});
