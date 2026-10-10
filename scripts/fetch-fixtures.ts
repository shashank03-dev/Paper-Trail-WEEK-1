/**
 * Replace the hand-traced demo presets with live OpenStreetMap + Open-Meteo data.
 * Needs network. Run once and commit the results:  pnpm fixtures:fetch
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { normalizeOverpass, overpassQuery, type OverpassResponse } from "@/lib/places/overpass";
import { PRESETS } from "@/lib/presets";
import { codeToCondition } from "@/lib/weather";
import type { Weather } from "@/lib/schemas";

const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const UA = `PaperTrail/1.0 (+${process.env.REPO_URL ?? "https://github.com/shashank03-dev/Paper-Trail-WEEK-1"})`;

async function main() {
  mkdirSync("fixtures/places", { recursive: true });
  mkdirSync("fixtures/overpass", { recursive: true });
  mkdirSync("fixtures/weather", { recursive: true });
  for (const p of PRESETS) {
    process.stdout.write(`${p.id}: overpass… `);
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
      body: `data=${encodeURIComponent(overpassQuery(p.lat, p.lon, 900))}`,
    });
    if (!res.ok) throw new Error(`Overpass ${res.status} for ${p.id}`);
    const raw = (await res.json()) as OverpassResponse;
    const places = normalizeOverpass(raw, p.lat, p.lon, 900);
    writeFileSync(`fixtures/overpass/${p.id}.json`, JSON.stringify(raw));
    writeFileSync(
      `fixtures/places/${p.id}.json`,
      JSON.stringify(
        {
          meta: {
            preset: p.id,
            center: { lat: p.lat, lon: p.lon },
            radiusM: 900,
            source: "osm",
            fetchedAt: new Date().toISOString(),
            note: "© OpenStreetMap contributors (ODbL).",
          },
          ...places,
        },
        null,
        1,
      ),
    );
    process.stdout.write(
      `${places.features.length} features, ${places.ways.length} ways. weather… `,
    );
    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.search = new URLSearchParams({
      latitude: String(p.lat),
      longitude: String(p.lon),
      current: "temperature_2m,weather_code,wind_speed_10m,is_day",
      hourly: "precipitation_probability",
      daily: "sunset",
      forecast_hours: "3",
      forecast_days: "1",
      timezone: "auto",
    }).toString();
    const w = (await (await fetch(u)).json()) as {
      current: {
        temperature_2m: number;
        weather_code: number;
        wind_speed_10m: number;
        is_day: number;
      };
      hourly: { precipitation_probability: (number | null)[] };
      daily: { sunset: string[] };
    };
    const weather: Weather = {
      tempC: w.current.temperature_2m,
      condition: codeToCondition(w.current.weather_code),
      precipProbNext2h: Math.max(
        0,
        ...w.hourly.precipitation_probability.slice(0, 2).map((x) => x ?? 0),
      ),
      windKph: w.current.wind_speed_10m,
      sunset: (w.daily.sunset[0] ?? "T18:30").split("T")[1]!.slice(0, 5),
      isDaylight: w.current.is_day === 1,
    };
    writeFileSync(`fixtures/weather/${p.id}.json`, JSON.stringify(weather, null, 2));
    console.log("ok");
    await new Promise((r) => setTimeout(r, 1500)); // be polite to Overpass
  }
  console.log(
    "Done. Re-run `pnpm fixtures:record` and `pnpm fixtures:photos` so replays and photos match.",
  );
}

void main();
