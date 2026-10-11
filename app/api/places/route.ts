import { NextResponse } from "next/server";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { cached, stale } from "@/lib/server/cache";
import { nearestPreset, presetPlaces } from "@/lib/server/fixtures";
import { jsonError, parseBody, route } from "@/lib/server/http";
import { normalizeOverpass, overpassQuery } from "@/lib/places/overpass";
import {
  DEFAULT_OVERPASS_URLS,
  OverpassUnavailable,
  fetchOverpass,
  type Attempt,
} from "@/lib/places/fetchOverpass";
import { fetchTilePlaces } from "@/lib/places/tiles";
import { bearingDeg, distanceM } from "@/lib/geo";
import type { Places } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusM: z.number().min(100).max(1500),
  presetId: z.string().max(40).optional(),
});

export const POST = route("places", async (req, rc) => {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const { lat, lon, radiusM } = b.data;
  const s = serverConfig();
  const presetId = b.data.presetId ?? (s.demoMode ? nearestPreset(lat, lon).id : undefined);
  if (presetId) {
    const p = await presetPlaces(presetId);
    if (!p) return jsonError(404, "Unknown preset.");
    rc.note({ source: "fixture" });
    return NextResponse.json({ ...recenter(p, lat, lon, radiusM), source: "fixture", presetId });
  }
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(radiusM)}`;
  const userAgent = `PaperTrail/1.0 (+${s.repoUrl})`;
  let attempts: Attempt[] = [];
  // Two independent sources, asked together. Overpass is the richer one
  // (trees, benches, street lamps); OpenStreetMap vector tiles are the fast,
  // dependable backup. Overpass gets a head start; if it hasn't answered by
  // then, the tiles make the walk, and Overpass's answer is still cached for
  // next time.
  const overpass = cached("places", key, async () => {
    try {
      const r = await fetchOverpass(
        // Configured servers first; the public list always backs them up.
        [...s.overpassUrls, ...DEFAULT_OVERPASS_URLS],
        overpassQuery(lat, lon, radiusM),
        { userAgent, signal: rc.signal },
      );
      attempts = r.attempts;
      return normalizeOverpass(r.data, lat, lon, radiusM);
    } catch (e) {
      if (e instanceof OverpassUnavailable) attempts = e.attempts;
      throw e;
    }
  });
  const tiles = cached("tiles", key, () =>
    fetchTilePlaces(lat, lon, radiusM, {
      ...(s.tileJsonUrl ? { tileJsonUrl: s.tileJsonUrl } : {}),
      userAgent,
      signal: rc.signal,
    }),
  );
  // Neither may surface as an unhandled rejection while the other is awaited.
  overpass.catch(() => undefined);
  tiles.catch(() => undefined);

  const settle = <T>(p: Promise<T>) =>
    p.then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e }),
    );
  const early = await Promise.race([
    settle(overpass),
    new Promise<null>((r) => setTimeout(() => r(null), OVERPASS_HEAD_START_MS)),
  ]);
  if (early?.ok) {
    rc.note({ source: "osm", features: early.v.features.length, ...overpassLog(attempts) });
    return NextResponse.json({ ...early.v, source: "osm" });
  }
  if (rc.signal.aborted) throw rc.signal.reason;

  const t = await settle(tiles);
  if (t.ok && t.v.features.length >= 3) {
    rc.note({
      source: "tiles",
      features: t.v.features.length,
      overpassPending: !early,
      ...overpassLog(attempts),
    });
    return NextResponse.json({ ...t.v, source: "osm" });
  }
  // The tiles failed or are thin here: give Overpass the rest of its time.
  const o = early ?? (await settle(overpass));
  if (o.ok) {
    rc.note({ source: "osm", features: o.v.features.length, ...overpassLog(attempts) });
    return NextResponse.json({ ...o.v, source: "osm" });
  }
  if (rc.signal.aborted) throw rc.signal.reason;
  // Both down: the last map of these same streets still makes a true walk.
  const old = (await stale<Places>("places", key)) ?? (await stale<Places>("tiles", key));
  if (old) {
    rc.note({ source: "stale", features: old.features.length, ...overpassLog(attempts) });
    return NextResponse.json({ ...old, source: "osm" });
  }
  // Thin tiles are still the truth about this spot (the page explains it's thin).
  if (t.ok) {
    rc.note({ source: "tiles", features: t.v.features.length, ...overpassLog(attempts) });
    return NextResponse.json({ ...t.v, source: "osm" });
  }
  rc.note({
    ...overpassLog(attempts),
    error: `${(o.e as Error).message} | tiles: ${(t.e as Error).message}`.slice(0, 300),
  });
  return jsonError(
    502,
    "OpenStreetMap isn't answering right now, so the map around you can't be read. Try again in a minute, or pick a demo preset.",
    undefined,
    { "retry-after": "30" },
  );
});

/** How long Overpass (the richer source) gets before the tiles are used instead. */
const OVERPASS_HEAD_START_MS = 6000;

/** Which Overpass servers were tried and why they failed, for the request log. */
function overpassLog(attempts: Attempt[]) {
  return attempts.length
    ? { overpass: attempts.map((a) => `${a.host} ${a.error ?? "ok"} ${a.ms}ms`).join(" | ") }
    : {};
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
