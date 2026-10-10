/**
 * Exports the real zine for the launch video: the product's own <Sheet> and
 * <PageSvg> renderers, fed a Dolores Park trail from the deterministic writer,
 * plus the pencil marks a walker would add (6 of 8 I-Spy ticks, a riddle
 * answer, a sketch, three sounds). Writes video/build/zine.json.
 *
 *   pnpm video:zine
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Sheet } from "@/lib/zine/Sheet";
import { PageSvg } from "@/lib/zine/PageSvg";
import {
  ispyRows,
  listenLines,
  panelToSheet,
  riddleAnswerBox,
  sheetGeometry,
  sketchFrame,
  PAGES,
} from "@/lib/zine/layout";
import { makeRough } from "@/lib/zine/rough";
import { buildContext } from "@/lib/writer/context";
import {
  fallbackBack,
  fallbackCover,
  fallbackListen,
  fallbackPlan,
  fallbackRoute,
} from "@/lib/writer/fallback";
import { presetById } from "@/lib/presets";
import { score } from "@/lib/reader/score";
import type { FieldReport, Places, Weather } from "@/lib/schemas";

const OUT = "video/build";
const PENCIL = "#3b3b40";
/** Which of the 8 I-Spy rows the walker ticked. */
const TICKED = [true, true, false, true, true, false, true, true];

function main() {
  const preset = presetById("dolores-park")!;
  const places = JSON.parse(readFileSync(`fixtures/places/${preset.id}.json`, "utf8")) as Places;
  const weather = JSON.parse(readFileSync(`fixtures/weather/${preset.id}.json`, "utf8")) as Weather;
  const ctx = buildContext({
    places,
    weather,
    location: { lat: preset.lat, lon: preset.lon, label: `${preset.name}, ${preset.city}` },
    durationMin: 20,
    companions: "solo",
    edition: 1,
    presetId: preset.id,
    now: new Date("2026-10-10T10:00:00Z"),
  });
  const full = fallbackPlan(ctx);
  // The plan allows 8–10 I-Spy items; the video's report says "6 of 8", so keep 8.
  const plan = { ...full, ispy: full.ispy.slice(0, 8) };
  const data = {
    id: "launch",
    paper: "letter" as const,
    color: true,
    plan,
    panels: {
      cover: fallbackCover(ctx),
      route: fallbackRoute(ctx),
      listen: fallbackListen(ctx, plan),
      back: fallbackBack(),
    },
    route: ctx.route,
    features: ctx.features,
    ways: places.ways,
    weather,
    date: ctx.date,
    edition: 1,
    model: "gemma4:31b",
    deviceLabel: "Ollama Cloud",
    // The live site runs a hosted model, so the colophon must not promise local-only.
    hostedOn: "Ollama Cloud",
    returnUrl: "https://paper-trail-t6mp.onrender.com/return/launch",
    repoUrl: "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
    locationLabel: ctx.location.label,
    durationMin: ctx.durationMin,
  };
  const g = sheetGeometry("letter");
  const sheet = renderToStaticMarkup(createElement(Sheet, { data, paperBg: false }));
  const pages = Object.fromEntries(
    PAGES.map((p) => [p, renderToStaticMarkup(createElement(PageSvg, { data, page: p }))]),
  );

  // ---- pencil marks, panel-local (mm) ----
  const rc = makeRough(20261010);
  const paths = (d: ReturnType<typeof rc.line>) => rc.toPaths(d).map((p) => p.d);
  const o = { stroke: PENCIL, strokeWidth: 0.55, roughness: 1.1, disableMultiStroke: true };
  const rows = ispyRows(g, plan.ispy.length);
  const ticks = rows.map((r, i) => {
    const b = r.box;
    return {
      index: i,
      ticked: TICKED[i]!,
      box: b,
      // One stroke: down into the box, then up and out past its corner, like a quick tick.
      d: TICKED[i]
        ? paths(
            rc.curve(
              [
                [b.x + b.w * 0.16, b.y + b.h * 0.52],
                [b.x + b.w * 0.42, b.y + b.h * 0.86],
                [b.x + b.w * 0.7, b.y + b.h * 0.35],
                [b.x + b.w * 1.02, b.y - b.h * 0.18],
              ],
              o,
            ),
          )
        : [],
      label: plan.ispy[i]!.label,
      points: plan.ispy[i]!.points,
      centre: panelToSheet(g, 4, b.x + b.w / 2, b.y + b.h / 2),
    };
  });
  const listen = listenLines(g).map((l, i) => ({
    x: g.panelW * 0.2,
    y: l.lines[0]! - 0.8,
    text: ["a bike bell", "my own shoes", "the fountain"][i]!,
  }));
  const ab = riddleAnswerBox(g);
  const riddle = { x: ab.x + 5, y: ab.y + ab.h - 6, text: plan.riddle.answer };
  const fr = sketchFrame(g);
  const sk = { stroke: PENCIL, strokeWidth: 0.45, roughness: 1.5 };
  const cx = fr.x + fr.w / 2;
  const by = fr.y + fr.h - 6;
  const sketch = [
    rc.line(cx, by, cx, by - 25, sk),
    rc.line(cx, by - 15, cx - 10, by - 28, sk),
    rc.line(cx, by - 18, cx + 11, by - 30, sk),
    rc.circle(cx, by - 34, 22, sk),
    rc.circle(cx - 9, by - 28, 12, sk),
    rc.line(fr.x + 4, by, fr.x + fr.w - 4, by - 1.5, sk),
  ].flatMap(paths);

  const report: FieldReport = {
    ispy: ticks.map((t) => ({
      index: t.index,
      spotted: t.ticked,
      source: "omr" as const,
      confidence: 1,
      unsure: false,
    })),
    riddle: { written: riddle.text, verdict: "correct", note: "" },
    sketch: { isBlank: false, description: "" },
    listen: { loudest: listen[0]!.text, quietest: listen[1]!.text, newSound: listen[2]!.text },
    letter: "",
  };
  const s = score(
    report,
    ticks.map((t) => t.points),
  );

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/zine.json`,
    JSON.stringify({
      sheet,
      pages,
      geometry: g,
      title: plan.title,
      ticks,
      listen,
      riddle,
      sketch,
      score: s,
      date: "10 Oct 2026",
    }),
  );
  console.log(
    `zine: "${plan.title}" · ${s.spotted} of ${s.of} spotted · ${s.total} pts → ${OUT}/zine.json`,
  );
}

main();
