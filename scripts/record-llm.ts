/**
 * Record real Gemma output for demo replay (DEMO_MODE=true with the model offline).
 *   ollama serve & ollama pull gemma4:e4b
 *   pnpm fixtures:record
 * Writes fixtures/llm/<preset>/<task>.json and fixtures/llm/_reader/<task>.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { llmConfig, endpointLabel } from "@/lib/config";
import { isMock } from "./eval-common";
import { createChat } from "@/lib/llm/client";
import type { Chat } from "@/lib/llm/types";
import { buildContext } from "@/lib/writer/context";
import { generatePanel, generatePlan } from "@/lib/writer/generate";
import { readSheet } from "@/lib/reader/read";
import { detect, processPhoto } from "@/lib/vision/sheet";
import { PRESETS } from "@/lib/presets";
import type { Expected, Places, Weather } from "@/lib/schemas";
import type { RGBA } from "@/lib/vision/image";

const cfg = llmConfig();
const live = createChat(cfg);
const label = endpointLabel(cfg.baseURL);

/** Wraps the chat to keep the last response per TASK. */
function recorder() {
  const got = new Map<string, string>();
  const chat: Chat = async (req, o) => {
    const r = await live(req, o);
    const u = req.messages.find((m) => m.role === "user");
    const t =
      typeof u?.content === "string"
        ? u.content
        : ((u?.content.find((p) => p.type === "text") as { text: string } | undefined)?.text ?? "");
    const task = t.match(/^TASK: ([\w-]+)/m)?.[1];
    if (task) got.set(task, r.content);
    return r;
  };
  return { chat, got };
}

function save(dir: string, got: Map<string, string>, model: string) {
  mkdirSync(dir, { recursive: true });
  for (const [task, content] of got)
    writeFileSync(
      `${dir}/${task}.json`,
      JSON.stringify(
        {
          task,
          model: isMock
            ? "mock-llm (placeholder, NOT Gemma — re-record with `pnpm fixtures:record`)"
            : model,
          endpoint: label,
          recordedAt: new Date().toISOString(),
          content,
        },
        null,
        1,
      ),
    );
}

const pngUrl = (img: RGBA) =>
  `data:image/png;base64,${PNG.sync.write({ width: img.width, height: img.height, data: Buffer.from(img.data) } as unknown as PNG).toString("base64")}`;

async function main() {
  console.log(`recording from ${cfg.modelText} at ${label}`);
  for (const p of PRESETS) {
    const places = JSON.parse(readFileSync(`fixtures/places/${p.id}.json`, "utf8")) as Places;
    const weather = JSON.parse(readFileSync(`fixtures/weather/${p.id}.json`, "utf8")) as Weather;
    const ctx = buildContext({
      places,
      weather,
      location: { lat: p.lat, lon: p.lon, label: `${p.name}, ${p.city}` },
      durationMin: 20,
      companions: "solo",
      edition: 1,
      presetId: p.id,
    });
    const { chat, got } = recorder();
    const w = { chat, model: cfg.modelText };
    const { plan, meta } = await generatePlan(w, ctx);
    for (const panel of ["cover", "route", "listen", "back"] as const)
      await generatePanel(w, panel, ctx, plan);
    save(`fixtures/llm/${p.id}`, got, cfg.modelText);
    console.log(`${p.id}: plan via ${meta.path}, ${got.size} tasks recorded`);
  }
  const truth = JSON.parse(readFileSync("fixtures/photos/sheet-00.json", "utf8")) as {
    paper: "letter" | "a4";
    expected: Expected;
  };
  const d = jpeg.decode(readFileSync("fixtures/photos/sheet-00.jpg"), {
    useTArray: true,
    formatAsRGBA: true,
  });
  const img = { width: d.width, height: d.height, data: new Uint8ClampedArray(d.data) };
  const det = detect(img);
  if (!det.corners) throw new Error("fiducials not found on sample photo");
  const proc = processPhoto(img, truth.paper, det.corners, truth.expected.ispy.length);
  const { chat, got } = recorder();
  await readSheet({
    chat,
    model: cfg.modelVision,
    panels: {
      4: pngUrl(proc.panels[4]),
      5: pngUrl(proc.panels[5]),
      6: pngUrl(proc.panels[6]),
      7: pngUrl(proc.panels[7]),
    },
    expected: truth.expected,
    omr: proc.omr,
    mode: "per-panel+omr",
  });
  save("fixtures/llm/_reader", got, cfg.modelVision);
  console.log(`reader: ${got.size} tasks recorded`);
}

void main();
