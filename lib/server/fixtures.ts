import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Places, Weather } from "@/lib/schemas";
import { presetById, PRESETS } from "@/lib/presets";
import { distanceM } from "@/lib/geo";

const dir = (...p: string[]) => join(process.cwd(), "fixtures", ...p);

export async function presetPlaces(id: string): Promise<Places | null> {
  if (!presetById(id)) return null;
  try {
    const j = JSON.parse(await readFile(dir("places", `${id}.json`), "utf8")) as Places;
    return { features: j.features, ways: j.ways };
  } catch {
    return null;
  }
}

export async function presetWeather(id: string): Promise<Weather | null> {
  if (!presetById(id)) return null;
  try {
    return JSON.parse(await readFile(dir("weather", `${id}.json`), "utf8")) as Weather;
  } catch {
    return null;
  }
}

/** In demo mode, a click anywhere snaps to the nearest preset. */
export function nearestPreset(lat: number, lon: number) {
  return PRESETS.reduce((a, b) =>
    distanceM(lat, lon, b.lat, b.lon) < distanceM(lat, lon, a.lat, a.lon) ? b : a,
  );
}

/** Recorded Gemma output for a preset + task (fixtures/llm/<preset>/<task>.json). */
export async function replayContent(presetId: string, task: string): Promise<string | null> {
  if (!presetById(presetId) || !/^[\w-]+$/.test(task)) return null;
  try {
    const j = JSON.parse(await readFile(dir("llm", presetId, `${task}.json`), "utf8")) as {
      content: string;
    };
    return j.content;
  } catch {
    return null;
  }
}
