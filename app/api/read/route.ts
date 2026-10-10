import { z } from "zod";
import { ExpectedSchema } from "@/lib/schemas";
import { parseBody, route, sse } from "@/lib/server/http";
import { chatFor } from "@/lib/server/chat";
import { readSheet } from "@/lib/reader/read";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Png = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
  .max(3_000_000);
const Body = z.object({
  trailId: z.string().max(32),
  panelImages: z.object({
    4: Png.optional(),
    5: Png.optional(),
    6: Png.optional(),
    7: Png.optional(),
  }),
  wholeSheet: Png.optional(),
  expected: ExpectedSchema.nullable(),
  omr: z.array(z.number().min(0).max(1)).max(12).nullable(),
  mode: z.enum(["per-panel", "per-panel+omr", "whole-sheet"]).default("per-panel+omr"),
});

/** The reader: per-panel Gemma vision + OMR, streamed panel by panel. */
export const POST = route("read", async (req, rc) => {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const ac = new AbortController();
  rc.signal.addEventListener("abort", () => ac.abort());
  const { chat, mode, cfg, usage } = await chatFor(req.headers, "_reader", ac.signal);
  return sse(
    async (send, signal) => {
      signal.addEventListener("abort", () => ac.abort());
      send({ type: "status", model: cfg.modelVision, mode });
      const r = await readSheet({
        chat,
        model: cfg.modelVision,
        panels: b.data.panelImages,
        wholeSheet: b.data.wholeSheet,
        expected: b.data.expected,
        omr: b.data.omr,
        mode: b.data.mode,
        onStep: (step) => send({ type: "step", ...step }),
      });
      send({
        type: "report",
        report: r.report,
        labels: r.labels,
        timings: r.timings,
        paths: r.paths,
      });
    },
    {
      rid: rc.rid,
      route: "read",
      note: () => ({ calls: usage.calls, modelMs: usage.ms, provider: usage.providers.join(",") }),
    },
  );
});
