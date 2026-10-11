import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import type { Feature, Places, Way } from "@/lib/schemas";
import { bearingDeg, distanceM, simplify } from "@/lib/geo";
import { dedupe, diversify, MAX_FEATURES } from "./overpass";

/**
 * The backup source for places: OpenStreetMap vector tiles (OpenMapTiles
 * schema) from OpenFreeMap, which are free, need no key and run on different
 * servers from Overpass. One zoom-14 tile (~2.4 km across at the equator)
 * carries the streets, paths, water, parks and named points of interest of a
 * neighbourhood. It is a little thinner than Overpass (no trees, benches or
 * street lamps), but it is fast and almost always up, so a walk never stops
 * at the map.
 */
export const DEFAULT_TILEJSON_URL = "https://tiles.openfreemap.org/planet";
export const TILE_Z = 14;

export interface TileId {
  z: number;
  x: number;
  y: number;
}

const lonToX = (lon: number, n: number) => ((lon + 180) / 360) * n;
const latToY = (lat: number, n: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
};

/** The zoom-14 tiles that cover a circle of `radiusM` around a point (one to four, usually). */
export function tilesForRadius(lat: number, lon: number, radiusM: number, z = TILE_Z): TileId[] {
  const n = 2 ** z;
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const x0 = Math.floor(lonToX(lon - dLon, n));
  const x1 = Math.floor(lonToX(lon + dLon, n));
  const y0 = Math.floor(latToY(Math.min(85, lat + dLat), n));
  const y1 = Math.floor(latToY(Math.max(-85, lat - dLat), n));
  const out: TileId[] = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) out.push({ z, x: ((x % n) + n) % n, y });
  return out;
}

/** OpenMapTiles `poi` class/subclass → the kinds the writer knows (see classify in overpass.ts). */
export function poiKind(cls: string, sub: string): string | null {
  if (sub === "artwork") return "artwork";
  if (cls === "monument" || sub === "memorial" || sub === "monument") return "memorial";
  if (cls === "castle" || sub === "ruins" || sub === "archaeological_site" || sub === "historic")
    return "historic";
  if (sub === "viewpoint") return "viewpoint";
  if (sub === "fountain") return "fountain";
  if (sub === "drinking_water") return "drinking_water";
  if (sub === "post_box") return "post_box";
  if (cls === "library" && sub === "library") return "library";
  if (cls === "cafe") return "cafe";
  if (sub === "bicycle_parking") return "bicycle_parking";
  if (sub === "waste_basket") return "waste_basket";
  if (sub === "clock") return "clock";
  if (sub === "bench") return "bench";
  if (cls === "park" && sub === "park") return "park";
  if (sub === "garden") return "garden";
  if (sub === "playground") return "playground";
  if (sub === "bus_stop") return "bus_stop";
  if (sub === "bakery") return "bakery";
  if (sub === "florist") return "florist";
  return null;
}

function roadKind(cls: string): Way["kind"] | null {
  if (/^(motorway|trunk|primary|secondary|tertiary)$/.test(cls)) return "major";
  if (/^(minor|service|residential|living_street)$/.test(cls)) return "minor";
  if (cls === "path" || cls === "track") return "path";
  return null;
}

type LonLat = [number, number];
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Turn decoded tiles into the same `Places` the Overpass path produces:
 * features within the radius (diverse, de-duplicated, nearest first) and the
 * street, path, park and water geometry around them.
 */
export function normalizeTiles(
  tiles: { id: TileId; data: Uint8Array }[],
  lat: number,
  lon: number,
  radiusM: number,
): Places {
  const feats: Feature[] = [];
  const areas: Way[] = [];
  const roads: { way: Way; d: number }[] = [];
  let seq = 0;
  const near = (coords: LonLat[]) =>
    coords.some(([lo, la]) => distanceM(lat, lon, la, lo) <= radiusM * 1.6);
  const addWay = (
    kind: Way["kind"],
    ring: LonLat[],
    closed: boolean,
    osmId: number | undefined,
  ) => {
    if (ring.length < 2 || !near(ring)) return;
    const coords = simplify(
      ring.map(([lo, la]) => [la, lo] as [number, number]),
      kind === "park" || kind === "water" ? 4 : 2.5,
    ).map(([a, b]) => [round6(a), round6(b)] as [number, number]);
    if (coords.length < 2) return;
    const way: Way = { id: `w${osmId ?? 9_000_000 + seq}-${seq++}`, kind, closed, coords };
    if (closed) areas.push(way);
    else
      roads.push({
        way,
        d: Math.min(...coords.map(([la, lo]) => distanceM(lat, lon, la, lo))),
      });
  };

  for (const { id: t, data } of tiles) {
    const vt = new VectorTile(new Pbf(data));
    const poi = vt.layers.poi;
    for (let i = 0; poi && i < poi.length; i++) {
      const f = poi.feature(i);
      const p = f.properties as Record<string, string | number | boolean | undefined>;
      const kind = poiKind(String(p.class ?? ""), String(p.subclass ?? ""));
      if (!kind) continue;
      const g = f.toGeoJSON(t.x, t.y, t.z).geometry;
      if (g.type !== "Point") continue;
      const [plon, plat] = g.coordinates as LonLat;
      const d = distanceM(lat, lon, plat, plon);
      if (d > radiusM) continue;
      const name = typeof p.name === "string" && p.name ? p.name.slice(0, 48) : undefined;
      feats.push({
        id: `n${f.id ?? 9_000_000 + seq++}`,
        kind,
        ...(name ? { name } : {}),
        tags: name ? { name } : {},
        lat: round6(plat),
        lon: round6(plon),
        distanceM: Math.round(d),
        bearingDeg: Math.round(bearingDeg(lat, lon, plat, plon)),
      });
    }

    const roads = vt.layers.transportation;
    for (let i = 0; roads && i < roads.length; i++) {
      const f = roads.feature(i);
      const kind = roadKind(String(f.properties.class ?? ""));
      if (!kind) continue;
      const g = f.toGeoJSON(t.x, t.y, t.z).geometry;
      if (g.type === "LineString") addWay(kind, g.coordinates as LonLat[], false, f.id);
      else if (g.type === "MultiLineString")
        for (const line of g.coordinates as LonLat[][]) addWay(kind, line, false, f.id);
    }

    const areaLayers: [string, (p: Record<string, unknown>) => Way["kind"] | null][] = [
      ["water", () => "water"],
      ["landcover", (p) => (p.subclass === "park" || p.subclass === "garden" ? "park" : null)],
      // The `park` layer also holds historic districts; only real parks count.
      ["park", (p) => (/^(park|nature_reserve)$/.test(String(p.class)) ? "park" : null)],
    ];
    for (const [layerName, kindOf] of areaLayers) {
      const layer = vt.layers[layerName];
      for (let i = 0; layer && i < layer.length; i++) {
        const f = layer.feature(i);
        const kind = kindOf(f.properties);
        if (!kind) continue;
        const g = f.toGeoJSON(t.x, t.y, t.z).geometry;
        // Outer rings only: the map fills these, and holes are rare at this scale.
        const polys =
          g.type === "Polygon"
            ? [g.coordinates as LonLat[][]]
            : g.type === "MultiPolygon"
              ? (g.coordinates as LonLat[][][])
              : [];
        for (const poly of polys) if (poly[0]) addWay(kind, poly[0], true, f.id);
      }
    }
  }
  // Parks and water first (few, and they shape the map), then the nearest streets.
  roads.sort((a, b) => a.d - b.d);
  const ways = [...areas.slice(0, 120), ...roads.map((r) => r.way)].slice(0, 700);
  return { features: diversify(dedupe(feats), MAX_FEATURES), ways };
}

let template: { url: string; at: number } | null = null;

/** Fetch the tiles around a point and normalise them. Throws if no tile could be fetched. */
export async function fetchTilePlaces(
  lat: number,
  lon: number,
  radiusM: number,
  opts: { tileJsonUrl?: string; userAgent: string; signal?: AbortSignal; fetchImpl?: typeof fetch },
): Promise<Places> {
  const doFetch = opts.fetchImpl ?? fetch;
  const signal = (ms: number) =>
    opts.signal ? AbortSignal.any([AbortSignal.timeout(ms), opts.signal]) : AbortSignal.timeout(ms);
  const headers = { "user-agent": opts.userAgent };
  // The tile URL carries the data version; TileJSON says which is current.
  if (!template || Date.now() - template.at > 6 * 60 * 60 * 1000) {
    const res = await doFetch(opts.tileJsonUrl ?? DEFAULT_TILEJSON_URL, {
      headers,
      signal: signal(6000),
    });
    if (!res.ok) throw new Error(`tilejson HTTP ${res.status}`);
    const j = (await res.json()) as { tiles?: string[] };
    const url = j.tiles?.[0];
    if (!url) throw new Error("tilejson without tiles");
    template = { url, at: Date.now() };
  }
  const ids = tilesForRadius(lat, lon, radiusM).slice(0, 6);
  const got = await Promise.all(
    ids.map(async (id) => {
      const u = template!.url
        .replace("{z}", String(id.z))
        .replace("{x}", String(id.x))
        .replace("{y}", String(id.y));
      try {
        const res = await doFetch(u, { headers, signal: signal(8000) });
        if (!res.ok) return null;
        return { id, data: new Uint8Array(await res.arrayBuffer()) };
      } catch {
        return null;
      }
    }),
  );
  const tiles = got.filter((t) => t !== null);
  if (!tiles.length) throw new Error("no map tiles");
  return normalizeTiles(tiles, lat, lon, radiusM);
}

/** For tests. */
export function resetTileTemplate(): void {
  template = null;
}
