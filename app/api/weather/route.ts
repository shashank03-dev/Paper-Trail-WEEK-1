import { NextResponse } from "next/server";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { cached } from "@/lib/server/cache";
import { nearestPreset, presetWeather } from "@/lib/server/fixtures";
import { parseBody, route } from "@/lib/server/http";
import type { Weather } from "@/lib/schemas";
import { codeToCondition } from "@/lib/weather";

export const dynamic = "force-dynamic";

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  presetId: z.string().max(40).optional(),
});

const MILD: Weather = {
  tempC: 16,
  condition: "partly-cloudy",
  precipProbNext2h: 10,
  windKph: 10,
  sunset: "18:30",
  isDaylight: true,
};

export const POST = route("weather", async (req, rc) => {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const { lat, lon } = b.data;
  const presetId =
    b.data.presetId ?? (serverConfig().demoMode ? nearestPreset(lat, lon).id : undefined);
  rc.note({ source: presetId ? "fixture" : "open-meteo" });
  if (presetId)
    return NextResponse.json({ ...((await presetWeather(presetId)) ?? MILD), source: "fixture" });
  try {
    const w = await cached(
      "weather",
      `${lat.toFixed(2)},${lon.toFixed(2)},${new Date().toISOString().slice(0, 13)}`,
      async () => {
        const u = new URL("https://api.open-meteo.com/v1/forecast");
        u.search = new URLSearchParams({
          latitude: lat.toFixed(4),
          longitude: lon.toFixed(4),
          current: "temperature_2m,weather_code,wind_speed_10m,is_day",
          hourly: "precipitation_probability",
          daily: "sunset",
          forecast_hours: "3",
          forecast_days: "1",
          timezone: "auto",
        }).toString();
        const res = await fetch(u, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`open-meteo ${res.status}`);
        const j = (await res.json()) as {
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
          tempC: j.current.temperature_2m,
          condition: codeToCondition(j.current.weather_code),
          precipProbNext2h: Math.max(
            0,
            ...j.hourly.precipitation_probability.slice(0, 2).map((x) => x ?? 0),
          ),
          windKph: j.current.wind_speed_10m,
          sunset: (j.daily.sunset[0] ?? "T18:30").split("T")[1]!.slice(0, 5),
          isDaylight: j.current.is_day === 1,
        };
        return weather;
      },
      30 * 60 * 1000,
    );
    return NextResponse.json({ ...w, source: "open-meteo" });
  } catch {
    // Weather is a nicety; never block a trail on it.
    return NextResponse.json({ ...MILD, source: "default" });
  }
});
