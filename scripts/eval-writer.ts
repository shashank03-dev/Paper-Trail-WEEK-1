/**
 * Writer eval: 3 presets × 3 durations × 4 companions.
 *   pnpm eval:writer            (against LLM_BASE_URL, default local Ollama)
 * Writes evals/results/writer.md
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createChat } from "@/lib/llm/client";
import { extractJson } from "@/lib/llm/json";
import type { Chat } from "@/lib/llm/types";
import { buildContext } from "@/lib/writer/context";
import { generatePanel, generatePlan } from "@/lib/writer/generate";
import { suspiciousNames } from "@/lib/writer/grounding";
import { fitsEverywhere } from "@/lib/zine/boxes";
import { PRESETS } from "@/lib/presets";
import {
  TrailPlanSchema,
  type Companions,
  type Duration,
  type Places,
  type Weather,
} from "@/lib/schemas";
import { banner, cfg, pct } from "./eval-common";

const MODELS = (process.env.EVAL_MODELS ?? cfg.modelText).split(",");
const live = createChat(cfg);

interface Row {
  model: string;
  firstTryValid: boolean;
  grounded: number;
  ispy: number;
  hallucinated: number;
  fits: boolean;
  path: string;
  latencyS: number;
}

async function main() {
  const rows: Row[] = [];
  for (const model of MODELS) {
    for (const p of PRESETS)
      for (const d of [10, 20, 40] as Duration[])
        for (const c of ["solo", "kids", "dog", "friend"] as Companions[]) {
          const places = JSON.parse(readFileSync(`fixtures/places/${p.id}.json`, "utf8")) as Places;
          const weather = JSON.parse(
            readFileSync(`fixtures/weather/${p.id}.json`, "utf8"),
          ) as Weather;
          const ctx = buildContext({
            places,
            weather,
            location: { lat: p.lat, lon: p.lon, label: `${p.name}, ${p.city}` },
            durationMin: d,
            companions: c,
            edition: 1,
            presetId: p.id,
          });
          let first: string | null = null;
          const chat: Chat = async (req, o) => {
            const r = await live(req, o);
            if (first === null) first = r.content;
            return r;
          };
          const t0 = Date.now();
          const w = { chat, model, log: () => {} };
          const { plan, meta } = await generatePlan(w, ctx);
          let firstTryValid = false;
          try {
            firstTryValid = TrailPlanSchema.safeParse(extractJson(first ?? "")).success;
          } catch {
            firstTryValid = false;
          }
          const ids = new Set(ctx.features.map((f) => f.id));
          const grounded = plan.ispy.filter((i) => i.featureId && ids.has(i.featureId)).length;
          const copy = await Promise.all(
            (["cover", "route", "listen", "back"] as const).map((k) =>
              generatePanel(w, k, ctx, plan),
            ),
          );
          const texts = [
            plan.title,
            plan.subtitle,
            plan.riddle.text,
            plan.sketchPrompt,
            ...plan.ispy.map((i) => `${i.label} ${i.hint}`),
            ...copy.map((x) => JSON.stringify(x.value)),
          ];
          const hallucinated =
            plan.ispy.filter((i) => i.featureId && !ids.has(i.featureId)).length +
            texts.flatMap((t) => suspiciousNames(t, ctx)).length;
          const [cover, route, listen, back] = copy.map((x) => x.value) as [
            { kicker: string; blurb: string },
            { stops: { text: string }[]; ifLost: { text: string } },
            { intro: string },
            { blurb: string },
          ];
          const fits =
            fitsEverywhere("coverTitle", plan.title) &&
            fitsEverywhere("riddleText", plan.riddle.text) &&
            fitsEverywhere("coverBlurb", cover.blurb) &&
            route.stops.every((s) =>
              fitsEverywhere("routeStop", s.text, { stops: ctx.route.waypoints.length }),
            ) &&
            fitsEverywhere("listenIntro", listen.intro) &&
            fitsEverywhere("backBlurb", back.blurb);
          rows.push({
            model,
            firstTryValid,
            grounded,
            ispy: plan.ispy.length,
            hallucinated,
            fits,
            path: meta.path,
            latencyS: (Date.now() - t0) / 1000,
          });
          process.stdout.write(`\r${model} ${rows.length}`);
        }
  }
  const lines = [
    "# Writer eval",
    "",
    banner(),
    "3 presets × 3 durations × 4 companion types = 36 trails per model. Plan + 4 panel calls each.",
    "",
    "| Model | Schema-valid 1st try | Grounding rate (I-Spy) | Hallucinated places (after validation) | Fits panel | Fell back to template | Latency / trail |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const m of MODELS) {
    const r = rows.filter((x) => x.model === m);
    const lat = r.map((x) => x.latencyS).sort((a, b) => a - b);
    lines.push(
      `| \`${m}\` | ${pct(r.filter((x) => x.firstTryValid).length, r.length).toFixed(0)}% | ${pct(
        r.reduce((s, x) => s + x.grounded, 0),
        r.reduce((s, x) => s + x.ispy, 0),
      ).toFixed(
        0,
      )}% | ${r.reduce((s, x) => s + x.hallucinated, 0)} | ${pct(r.filter((x) => x.fits).length, r.length).toFixed(0)}% | ${r.filter((x) => x.path === "fallback").length}/${r.length} | median ${lat[Math.floor(lat.length / 2)]!.toFixed(1)} s |`,
    );
  }
  lines.push(
    "",
    'Hallucinated places counts I-Spy ids not in the input plus capitalised place names ("X Street", "Y Cafe") in the copy that match no feature we gave the model. Validation retries should drive it to 0.',
    "",
  );
  mkdirSync("evals/results", { recursive: true });
  writeFileSync("evals/results/writer.md", lines.join("\n"));
  console.log("\nwrote evals/results/writer.md");
}

void main();
