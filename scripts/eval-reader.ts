/**
 * Reader eval over synthetic photographed sheets with ground truth.
 *   pnpm fixtures:photos --n 30 --out evals/out/sheets
 *   EVAL_MODELS=gemma4:e2b,gemma4:e4b pnpm eval:reader
 * Writes evals/results/reader.md and evals/results/reader.svg
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { createChat } from "@/lib/llm/client";
import { readSheet, type ReadMode } from "@/lib/reader/read";
import { combineTicks, levenshtein } from "@/lib/reader/combine";
import { detect, processPhoto } from "@/lib/vision/sheet";
import { defaultCorners } from "@/lib/vision/fiducials";
import type { RGBA } from "@/lib/vision/image";
import type { Expected } from "@/lib/schemas";
import { banner, barChart, cfg, pct } from "./eval-common";

const DIR =
  process.env.EVAL_SHEETS ??
  (existsSync("evals/out/sheets/index.json") ? "evals/out/sheets" : "fixtures/photos");
const MODELS = (process.env.EVAL_MODELS ?? "gemma4:e2b,gemma4:e4b").split(",");
const MODES: ReadMode[] = ["whole-sheet", "per-panel", "per-panel+omr"];
const live = createChat(cfg);

interface Truth {
  file: string;
  paper: "letter" | "a4";
  ticked: boolean[];
  listen: { loudest: string | null; quietest: string | null; newSound: string | null };
  riddle: { written: string | null; kind: "correct" | "close" | "incorrect" | "blank" };
  expected: Expected;
}

const png = (img: RGBA) =>
  `data:image/png;base64,${PNG.sync.write({ width: img.width, height: img.height, data: Buffer.from(img.data) } as unknown as PNG).toString("base64")}`;
const jpg = (img: RGBA) =>
  `data:image/jpeg;base64,${Buffer.from(jpeg.encode({ width: img.width, height: img.height, data: Buffer.from(img.data) }, 80).data).toString("base64")}`;

async function main() {
  const files = JSON.parse(readFileSync(`${DIR}/index.json`, "utf8")) as string[];
  const sheets = files.map((f) => {
    const truth = JSON.parse(readFileSync(`${DIR}/${f.replace(".jpg", ".json")}`, "utf8")) as Truth;
    const d = jpeg.decode(readFileSync(`${DIR}/${f}`), { useTArray: true, formatAsRGBA: true });
    const img: RGBA = { width: d.width, height: d.height, data: new Uint8ClampedArray(d.data) };
    const det = detect(img);
    const found = !!det.corners && det.confidence >= 0.5;
    const proc = processPhoto(
      img,
      truth.paper,
      found ? det.corners! : defaultCorners(img.width, img.height),
      truth.ticked.length,
    );
    return {
      truth,
      found,
      proc,
      whole: jpg(img),
      panels: {
        4: png(proc.panels[4]),
        5: png(proc.panels[5]),
        6: png(proc.panels[6]),
        7: png(proc.panels[7]),
      },
    };
  });
  const detected = sheets.filter((s) => s.found).length;

  type Res = { label: string; tick: number; cer: number; riddle: number; secs: number };
  const results: Res[] = [];
  // Baseline: classic OMR alone, no model.
  {
    let ok = 0;
    let n = 0;
    for (const s of sheets) {
      const ticks = combineTicks(s.truth.ticked.length, null, s.proc.omr);
      ticks.forEach((t, i) => {
        n++;
        if (t.spotted === s.truth.ticked[i]) ok++;
      });
    }
    results.push({
      label: "OMR only (no model)",
      tick: pct(ok, n),
      cer: NaN,
      riddle: NaN,
      secs: 0,
    });
  }
  for (const model of MODELS)
    for (const mode of MODES) {
      let tickOk = 0;
      let tickN = 0;
      let errs = 0;
      let chars = 0;
      let rOk = 0;
      let t = 0;
      for (const s of sheets) {
        const t0 = Date.now();
        const r = await readSheet({
          chat: live,
          model,
          panels: s.panels,
          wholeSheet: s.whole,
          expected: s.truth.expected,
          omr: s.proc.omr,
          mode,
        });
        t += (Date.now() - t0) / 1000;
        r.report.ispy.forEach((it, i) => {
          tickN++;
          if (it.spotted === s.truth.ticked[i]) tickOk++;
        });
        for (const k of ["loudest", "quietest", "newSound"] as const) {
          const truth = (s.truth.listen[k] ?? "").toLowerCase();
          const pred = (r.report.listen[k] ?? "").toLowerCase();
          errs += truth ? levenshtein(pred, truth) : pred.length;
          chars += Math.max(1, truth.length);
        }
        const want = s.truth.riddle.kind;
        const got = r.report.riddle.verdict;
        if (want === got || (want === "close" && got === "correct")) rOk++;
        process.stdout.write(`\r${model} ${mode} ${results.length}`);
      }
      results.push({
        label: `${model} · ${mode}`,
        tick: pct(tickOk, tickN),
        cer: pct(errs, chars),
        riddle: pct(rOk, sheets.length),
        secs: t / sheets.length,
      });
    }

  const md = [
    "# Reader eval",
    "",
    banner(),
    `${sheets.length} synthetic phone photos of filled-in sheets (\`${DIR}\`): random ticks (✓ ✗ filled), handwriting in 3 fonts with jitter, rough sketches, a correct / close / wrong / blank riddle answer; perspective tilt, rotation, shadow gradient, blur and JPEG noise. Fiducials detected automatically on **${detected}/${sheets.length}**.`,
    "",
    "| Reader | Tick accuracy | Handwriting CER (lower is better) | Riddle verdict accuracy | Seconds / sheet |",
    "| --- | --- | --- | --- | --- |",
    ...results.map(
      (r) =>
        `| ${r.label} | ${r.tick.toFixed(1)}% | ${Number.isNaN(r.cer) ? "—" : `${r.cer.toFixed(1)}%`} | ${Number.isNaN(r.riddle) ? "—" : `${r.riddle.toFixed(0)}%`} | ${r.secs.toFixed(1)} |`,
    ),
    "",
    'Close counts as right for riddle accuracy when the reader says "correct" for a misspelling (it\'s meant to be lenient).',
    "",
    "![Tick accuracy](reader.svg)",
    "",
  ].join("\n");
  mkdirSync("evals/results", { recursive: true });
  writeFileSync("evals/results/reader.md", md);
  writeFileSync(
    "evals/results/reader.svg",
    barChart(
      "Tick accuracy",
      results.map((r) => ({ label: r.label.replace("gemma4:", ""), value: r.tick })),
    ),
  );
  console.log("\nwrote evals/results/reader.md");
}

void main();
