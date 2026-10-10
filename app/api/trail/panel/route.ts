import { NextResponse } from "next/server";
import { z } from "zod";
import {
  RegenPanel,
  TrailPlanSchema,
  WriterContextSchema,
  CopyPanel,
  PlanPanel,
} from "@/lib/schemas";
import { parseBody } from "@/lib/server/http";
import { chatFor } from "@/lib/server/chat";
import { generatePanel, regeneratePlanPart } from "@/lib/writer/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({
  trailId: z.string().max(32),
  panel: RegenPanel,
  plan: TrailPlanSchema,
  context: WriterContextSchema,
});

/** Stage 2: write (or re-roll) one panel. */
export async function POST(req: Request) {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const { panel, plan, context } = b.data;
  const { chat, mode, cfg } = await chatFor(req.headers, context.presetId);
  const w = { chat, model: cfg.modelText };
  const t0 = Date.now();
  const fix = (p: string) => (mode === "replay" && p !== "fallback" ? "replay" : p);
  const copy = CopyPanel.safeParse(panel);
  if (copy.success) {
    const { value, meta } = await generatePanel(w, copy.data, context, plan);
    return NextResponse.json({
      panel,
      copy: value,
      path: fix(meta.path),
      ms: Date.now() - t0,
      tokens: meta.tokens,
    });
  }
  const { plan: next, meta } = await regeneratePlanPart(w, PlanPanel.parse(panel), context, plan);
  return NextResponse.json({
    panel,
    plan: next,
    path: fix(meta.path),
    ms: Date.now() - t0,
    tokens: meta.tokens,
  });
}
