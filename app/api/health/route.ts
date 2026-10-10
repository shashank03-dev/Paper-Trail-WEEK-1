import { NextResponse } from "next/server";
import { endpointLabel, llmConfig, serverConfig } from "@/lib/config";
import { createChat, approxTokens } from "@/lib/llm/client";

export const dynamic = "force-dynamic";

/** Pings the model with a tiny prompt: { ok, model, latencyMs, tokensPerSec }. */
export async function GET(req: Request) {
  const cfg = llmConfig(req.headers);
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
    return NextResponse.json({
      ok: true,
      model: cfg.modelText,
      where: endpointLabel(cfg.baseURL),
      latencyMs: Date.now() - t0,
      tokensPerSec: r.ms > 0 ? Math.round((tokens / (r.ms / 1000)) * 10) / 10 : null,
      mode: "live",
    });
  } catch (e) {
    const demo = serverConfig().demoMode;
    return NextResponse.json(
      {
        ok: false,
        model: cfg.modelText,
        where: endpointLabel(cfg.baseURL),
        latencyMs: Date.now() - t0,
        tokensPerSec: null,
        mode: demo ? "replay" : "down",
        error: String((e as Error).message).slice(0, 160),
      },
      { status: demo ? 200 : 503 },
    );
  }
}
