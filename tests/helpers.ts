import { readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import type { RGBA } from "@/lib/vision/image";
import type { Places, Weather } from "@/lib/schemas";
import { PRESETS } from "@/lib/presets";
import { buildContext } from "@/lib/writer/context";

export function loadJpeg(path: string): RGBA {
  const d = jpeg.decode(readFileSync(path), { useTArray: true, formatAsRGBA: true });
  return {
    width: d.width,
    height: d.height,
    data: new Uint8ClampedArray(d.data.buffer, d.data.byteOffset, d.data.byteLength),
  };
}

export function presetContext(
  i = 2,
  opts: { duration?: 10 | 20 | 40; companions?: "solo" | "kids" | "dog" | "friend" } = {},
) {
  const p = PRESETS[i]!;
  const places = JSON.parse(readFileSync(`fixtures/places/${p.id}.json`, "utf8")) as Places;
  const weather = JSON.parse(readFileSync(`fixtures/weather/${p.id}.json`, "utf8")) as Weather;
  const ctx = buildContext({
    places,
    weather,
    location: { lat: p.lat, lon: p.lon, label: `${p.name}, ${p.city}` },
    durationMin: opts.duration ?? 20,
    companions: opts.companions ?? "solo",
    edition: 3,
    presetId: p.id,
    now: new Date("2026-10-10T10:00:00Z"),
  });
  return { ctx, places, weather, preset: p };
}
