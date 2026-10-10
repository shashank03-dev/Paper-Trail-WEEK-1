import { NextResponse } from "next/server";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { cached } from "@/lib/server/cache";
import { nearestPreset, presetPlaces } from "@/lib/server/fixtures";
import { jsonError, parseBody } from "@/lib/server/http";
import { normalizeOverpass, overpassQuery, type OverpassResponse } from "@/lib/places/overpass";
import { bearingDeg, distanceM } from "@/lib/geo";
import type { Places } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusM: z.number().min(100).max(1500),
  presetId: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const { lat, lon, radiusM } = b.data;
  const s = serverConfig();
  const presetId = b.data.presetId ?? (s.demoMode ? nearestPreset(lat, lon).id : undefined);
  if (presetId) {
    const p = await presetPlaces(presetId);
    if (!p) return jsonError(404, "Unknown preset.");
    return NextResponse.json({ ...recenter(p, lat, lon, radiusM), source: "fixture", presetId });
  }
  try {
    const places = await cached(
      "places",
      `${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(radiusM)}`,
      async () => {
        const res = await fetch(s.overpassUrl, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": `PaperTrail/1.0 (+${s.repoUrl})`,
          },
          body: `data=${encodeURIComponent(overpassQuery(lat, lon, radiusM))}`,
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        return normalizeOverpass((await res.json()) as OverpassResponse, lat, lon, radiusM);
      },
    );
    return NextResponse.json({ ...places, source: "osm" });
  } catch (e) {
    return jsonError(
      502,
      `Couldn't reach OpenStreetMap (${(e as Error).message}). Try a demo preset.`,
    );
  }
}

/** Fixture data is stored around the preset centre; re-measure from where the walk starts. */
function recenter(p: Places, lat: number, lon: number, radiusM: number): Places {
  const features = p.features
    .map((f) => ({
      ...f,
      distanceM: Math.round(distanceM(lat, lon, f.lat, f.lon)),
      bearingDeg: Math.round(bearingDeg(lat, lon, f.lat, f.lon)),
    }))
    .filter((f) => f.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
  return { features, ways: p.ways };
}
