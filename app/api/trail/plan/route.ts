import { z } from "zod";
import { WriterContextSchema } from "@/lib/schemas";
import { parseBody, sse } from "@/lib/server/http";
import { chatFor } from "@/lib/server/chat";
import { generatePlan } from "@/lib/writer/generate";
import { endpointLabel } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({ context: WriterContextSchema });

/** Stage 1: the plan, streamed as SSE so the UI can show tok/s while Gemma writes. */
export async function POST(req: Request) {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const ctx = b.data.context;
  const { chat, mode, cfg } = await chatFor(req.headers, ctx.presetId);
  return sse(async (send) => {
    send({
      type: "status",
      stage: "plan",
      model: cfg.modelText,
      where: endpointLabel(cfg.baseURL),
      mode,
    });
    const t0 = Date.now();
    let chars = 0;
    let lastSent = 0;
    const { plan, meta } = await generatePlan({ chat, model: cfg.modelText }, ctx, {
      onDelta: (d) => {
        chars += d.length;
        const now = Date.now();
        if (now - lastSent > 250) {
          lastSent = now;
          const tokens = chars / 3.6;
          send({
            type: "tokens",
            tokens: Math.round(tokens),
            tps: Math.round((tokens / Math.max(0.001, (now - t0) / 1000)) * 10) / 10,
          });
        }
      },
    });
    const tps = meta.ms > 0 ? Math.round((meta.tokens / (meta.ms / 1000)) * 10) / 10 : null;
    send({
      type: "plan",
      plan,
      path: mode === "replay" && meta.path !== "fallback" ? "replay" : meta.path,
      attempts: meta.attempts,
      tps,
      ms: meta.ms,
    });
  });
}
