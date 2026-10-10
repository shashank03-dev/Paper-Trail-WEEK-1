/**
 * Renders zines to print resolution, "fills them in" with pencil ticks,
 * handwriting and rough sketches, then fakes a phone photo (perspective tilt,
 * rotation, shadow gradient, blur, JPEG noise). Writes images + ground truth.
 *
 *   pnpm fixtures:photos                      # 6 photos → fixtures/photos (committed, used by tests)
 *   pnpm fixtures:photos --n 30 --out evals/out/sheets   # eval set
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { chromium } from "@playwright/test";
import { Sheet } from "@/lib/zine/Sheet";
import {
  ispyRows,
  listenLines,
  panelTransform,
  riddleAnswerBox,
  sheetGeometry,
  sketchFrame,
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
import { PRESETS } from "@/lib/presets";
import type { Companions, Duration, Expected, Paper, Places, Weather } from "@/lib/schemas";

const arg = (k: string, d: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1]! : d;
};
const N = Number(arg("n", "6"));
const OUT = arg("out", "fixtures/photos");
const SEED = Number(arg("seed", "42"));

let s = SEED;
const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)]!;

const SOUNDS = [
  "a bus sighing",
  "pigeons arguing",
  "my own shoes",
  "wind in the palms",
  "a dog far away",
  "kids on swings",
  "a bike bell",
  "leaves skittering",
  "a radio",
  "the fountain",
  "a door closing",
  "birds",
  "traffic hum",
  "someone laughing",
];
const WRONG = ["bench", "tree", "lamp", "dog", "bin", "cloud"];
const HANDS = ["Caveat", "Reenie Beanie", "Nanum Pen Script"];
const PENCIL = "#3b3b40";

function misspell(w: string): string {
  if (w.length < 4) return `${w}e`;
  const i = 1 + Math.floor(rnd() * (w.length - 2));
  return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
}

function hand(x: number, y: number, text: string, size: number, font: string): string {
  const rot = (rnd() - 0.5) * 4;
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${PENCIL}" opacity="0.88" transform="rotate(${rot.toFixed(2)} ${x} ${y})">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
}

function pathsOf(
  rc: ReturnType<typeof makeRough>,
  d: ReturnType<ReturnType<typeof makeRough>["line"]>,
): string {
  return rc
    .toPaths(d)
    .map(
      (p) =>
        `<path d="${p.d}" stroke="${PENCIL}" stroke-width="${p.strokeWidth}" fill="none" stroke-linecap="round" opacity="0.85"/>`,
    )
    .join("");
}

function sketch(
  rc: ReturnType<typeof makeRough>,
  kind: string,
  fr: { x: number; y: number; w: number; h: number },
): string {
  const cx = fr.x + fr.w / 2;
  const by = fr.y + fr.h - 6;
  const o = { stroke: PENCIL, strokeWidth: 0.45, roughness: 1.6 };
  switch (kind) {
    case "tree":
      return [
        rc.line(cx, by, cx, by - 25, o),
        rc.line(cx, by - 15, cx - 10, by - 28, o),
        rc.line(cx, by - 18, cx + 11, by - 30, o),
        rc.circle(cx, by - 34, 22, o),
        rc.circle(cx - 9, by - 28, 12, o),
      ]
        .map((d) => pathsOf(rc, d))
        .join("");
    case "sun":
      return [
        rc.circle(cx, fr.y + 25, 16, o),
        ...Array.from({ length: 8 }, (_, i) =>
          rc.line(
            cx + Math.cos(i) * 11,
            fr.y + 25 + Math.sin(i) * 11,
            cx + Math.cos(i) * 17,
            fr.y + 25 + Math.sin(i) * 17,
            o,
          ),
        ),
        rc.line(fr.x + 4, by, fr.x + fr.w - 4, by - 2, o),
      ]
        .map((d) => pathsOf(rc, d))
        .join("");
    case "house":
      return [
        rc.rect(cx - 14, by - 22, 28, 22, o),
        rc.linear(
          [
            [cx - 17, by - 21],
            [cx, by - 36],
            [cx + 17, by - 21],
          ],
          o,
        ),
        rc.rect(cx - 4, by - 10, 8, 10, o),
      ]
        .map((d) => pathsOf(rc, d))
        .join("");
    default: // dog-ish
      return [
        rc.ellipse(cx, by - 14, 30, 14, o),
        rc.circle(cx + 17, by - 22, 10, o),
        rc.line(cx - 10, by - 8, cx - 11, by, o),
        rc.line(cx + 8, by - 8, cx + 9, by, o),
        rc.line(cx - 15, by - 16, cx - 22, by - 24, o),
      ]
        .map((d) => pathsOf(rc, d))
        .join("");
  }
}

interface Truth {
  file: string;
  paper: Paper;
  preset: string;
  ticked: boolean[];
  listen: { loudest: string | null; quietest: string | null; newSound: string | null };
  riddle: { written: string | null; kind: "correct" | "close" | "incorrect" | "blank" };
  sketch: { blank: boolean; kind: string };
  expected: Expected;
  photo: {
    rotZ: number;
    rotX: number;
    rotY: number;
    blur: number;
    shadow: number;
    quality: number;
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const fontsCss = readFileSync("app/fonts.css", "utf8").replaceAll(
    "/fonts/",
    `file://${resolve("public/fonts")}/`,
  );
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1350 } });
  const truths: Truth[] = [];
  const DURS: Duration[] = [10, 20, 40];
  const WHO: Companions[] = ["solo", "kids", "dog", "friend"];
  for (let i = 0; i < N; i++) {
    const preset = PRESETS[i % PRESETS.length]!;
    const paper: Paper = i % 2 === 0 ? "letter" : "a4";
    const places = JSON.parse(readFileSync(`fixtures/places/${preset.id}.json`, "utf8")) as Places;
    const weather = JSON.parse(
      readFileSync(`fixtures/weather/${preset.id}.json`, "utf8"),
    ) as Weather;
    const ctx = buildContext({
      places,
      weather,
      location: { lat: preset.lat, lon: preset.lon, label: `${preset.name}, ${preset.city}` },
      durationMin: DURS[i % 3]!,
      companions: WHO[i % 4]!,
      edition: i + 1,
      presetId: preset.id,
      now: new Date("2026-10-10T10:00:00Z"),
    });
    const plan = fallbackPlan(ctx);
    const id = `synth${String(i).padStart(3, "0")}`;
    const data = {
      id,
      paper,
      color: i % 3 === 0,
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
      edition: i + 1,
      model: "gemma4:e4b",
      deviceLabel: "my laptop",
      returnUrl: `http://localhost:3000/return/${id}`,
      repoUrl: "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
      locationLabel: ctx.location.label,
      durationMin: ctx.durationMin,
    };
    const svg = renderToStaticMarkup(createElement(Sheet, { data, paperBg: false }));
    const g = sheetGeometry(paper);
    const rc = makeRough(SEED * 31 + i);

    // ---- fill it in ----
    const n = plan.ispy.length;
    const rows = ispyRows(g, Math.max(n, 8)).slice(0, n);
    const ticked = rows.map(() => rnd() < 0.6);
    let p4 = "";
    rows.forEach((r, j) => {
      if (!ticked[j]) {
        // Occasionally a stray mark next to (not in) a box.
        if (rnd() < 0.1)
          p4 += pathsOf(
            rc,
            rc.line(r.textX + 20, r.y + r.pitch * 0.8, r.textX + 26, r.y + r.pitch * 0.75, {
              stroke: PENCIL,
              strokeWidth: 0.3,
            }),
          );
        return;
      }
      const b = r.box;
      const style = pick(["check", "check", "cross", "fill"]);
      const o = { stroke: PENCIL, strokeWidth: 0.55, roughness: 1.2 };
      if (style === "check")
        p4 += pathsOf(
          rc,
          rc.linear(
            [
              [b.x + b.w * 0.18, b.y + b.h * 0.55],
              [b.x + b.w * 0.42, b.y + b.h * 0.82],
              [b.x + b.w * 0.95, b.y - b.h * 0.1],
            ],
            o,
          ),
        );
      else if (style === "cross")
        p4 +=
          pathsOf(rc, rc.line(b.x + 1, b.y + 1, b.x + b.w - 1, b.y + b.h - 1, o)) +
          pathsOf(rc, rc.line(b.x + b.w - 1, b.y + 1, b.x + 1, b.y + b.h - 1, o));
      else
        p4 += pathsOf(
          rc,
          rc.rect(b.x + 0.9, b.y + 0.9, b.w - 1.8, b.h - 1.8, {
            ...o,
            fill: PENCIL,
            fillStyle: "zigzag",
            hachureGap: 0.7,
          }),
        );
    });
    const font = pick(HANDS);
    const fsize = font === "Caveat" ? 4.4 : 5;
    const listen = {
      loudest: rnd() < 0.85 ? pick(SOUNDS) : null,
      quietest: rnd() < 0.7 ? pick(SOUNDS) : null,
      newSound: rnd() < 0.6 ? pick(SOUNDS) : null,
    };
    let p5 = "";
    for (const l of listenLines(g)) {
      const v = listen[l.key];
      if (v) p5 += hand(g.panelW * 0.18 + rnd() * 3, l.lines[0]! - 0.8, v, fsize, font);
    }
    const kind = pick(["correct", "correct", "close", "incorrect", "blank"] as const);
    const written =
      kind === "blank"
        ? null
        : kind === "correct"
          ? plan.riddle.answer
          : kind === "close"
            ? misspell(plan.riddle.answer)
            : pick(WRONG.filter((w) => w !== plan.riddle.answer));
    const ab = riddleAnswerBox(g);
    const p6 = written ? hand(ab.x + 5, ab.y + ab.h - 6, written, fsize * 1.2, font) : "";
    const blank = rnd() < 0.12;
    const skKind = pick(["tree", "sun", "house", "dog"]);
    const p7 = blank ? "" : sketch(rc, skKind, sketchFrame(g));
    const overlay = [
      [4, p4],
      [5, p5],
      [6, p6],
      [7, p7],
    ]
      .map(([pg, c]) => `<g transform="${panelTransform(g, pg as 4)}">${c}</g>`)
      .join("");
    const filled = svg.replace("</svg>", `<g>${overlay}</g></svg>`);

    // ---- fake a phone photo ----
    const photo = {
      rotZ: (rnd() - 0.5) * 16,
      rotX: (rnd() - 0.5) * 22,
      rotY: (rnd() - 0.5) * 18,
      blur: rnd() * 1.1,
      shadow: 0.1 + rnd() * 0.3,
      quality: Math.round(55 + rnd() * 30),
    };
    const html = `<!doctype html><html><head><style>${fontsCss}
      html,body{margin:0;width:1800px;height:1350px;overflow:hidden;background:radial-gradient(circle at 30% 30%,#8a6d4f,#5b442f 70%);}
      .wrap{position:absolute;left:50%;top:50%;width:1450px;transform:translate(-50%,-50%) perspective(2200px) rotateX(${photo.rotX}deg) rotateY(${photo.rotY}deg) rotateZ(${photo.rotZ}deg);filter:blur(${photo.blur.toFixed(2)}px) saturate(.9);box-shadow:0 30px 60px rgba(0,0,0,.45);}
      .wrap svg{display:block;width:100%;height:auto;background:#f8f5ee}
      .shade{position:absolute;inset:0;background:linear-gradient(${Math.round(rnd() * 360)}deg,rgba(0,0,0,${photo.shadow.toFixed(2)}),transparent 65%);mix-blend-mode:multiply;pointer-events:none}
      .warm{position:absolute;inset:0;background:rgba(255,200,120,.08);pointer-events:none}
    </style></head><body><div class="wrap">${filled}<div class="shade"></div><div class="warm"></div></div></body></html>`;
    const tmp = join(resolve(OUT), `_tmp.html`);
    writeFileSync(tmp, html);
    await page.goto(`file://${tmp}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
    const file = `sheet-${String(i).padStart(2, "0")}.jpg`;
    await page.screenshot({ path: join(OUT, file), type: "jpeg", quality: photo.quality });
    const expected: Expected = {
      ispy: plan.ispy.map((x) => ({ label: x.label, points: x.points })),
      riddle: {
        text: plan.riddle.text,
        answer: plan.riddle.answer,
        acceptable: plan.riddle.acceptable,
      },
      sketchPrompt: plan.sketchPrompt,
      listenStop: plan.listenStop,
      title: plan.title,
    };
    const truth: Truth = {
      file,
      paper,
      preset: preset.id,
      ticked,
      listen,
      riddle: { written, kind },
      sketch: { blank, kind: skKind },
      expected,
      photo,
    };
    writeFileSync(join(OUT, file.replace(".jpg", ".json")), JSON.stringify(truth, null, 1));
    truths.push(truth);
    process.stdout.write(`\r${i + 1}/${N}`);
  }
  await browser.close();
  writeFileSync(join(OUT, "index.json"), JSON.stringify(truths.map((t) => t.file)));
  try {
    (await import("node:fs")).unlinkSync(join(resolve(OUT), "_tmp.html"));
  } catch {
    /* ignore */
  }
  if (OUT === "fixtures/photos") {
    mkdirSync("public/samples", { recursive: true });
    copyFileSync(join(OUT, "sheet-00.jpg"), "public/samples/filled-sheet.jpg");
  }
  console.log(`\nwrote ${N} synthetic photos to ${OUT}`);
}

void main();
