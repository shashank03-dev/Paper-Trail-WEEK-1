import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  fetchTilePlaces,
  normalizeTiles,
  poiKind,
  resetTileTemplate,
  tilesForRadius,
} from "@/lib/places/tiles";

// A real OpenFreeMap zoom-14 tile around Dolores Park, San Francisco (OpenStreetMap data, ODbL).
const TILE = { z: 14, x: 2620, y: 6333 };
const data = new Uint8Array(
  gunzipSync(readFileSync("fixtures/tiles/dolores-park-14-2620-6333.pbf.gz")),
);
const LAT = 37.7596;
const LON = -122.4269;

describe("map tiles as the backup source for places", () => {
  beforeEach(() => resetTileTemplate());

  it("picks the tiles that cover the walk", () => {
    const t = tilesForRadius(LAT, LON, 600);
    expect(t).toContainEqual(TILE);
    expect(t.length).toBeGreaterThanOrEqual(1);
    expect(t.length).toBeLessThanOrEqual(4);
    // A longer walk near a tile corner needs its neighbours too.
    expect(tilesForRadius(LAT, LON, 1500).length).toBeGreaterThan(1);
  });

  it("maps OpenMapTiles classes onto the kinds the writer knows", () => {
    expect(poiKind("art_gallery", "artwork")).toBe("artwork");
    expect(poiKind("park", "park")).toBe("park");
    expect(poiKind("cafe", "cafe")).toBe("cafe");
    expect(poiKind("library", "books")).toBeNull(); // a bookshop, not a library
    expect(poiKind("restaurant", "restaurant")).toBeNull();
  });

  it("turns a real tile into places: nearby features, streets, paths and parks", () => {
    const p = normalizeTiles([{ id: TILE, data }], LAT, LON, 600);
    expect(p.features.length).toBeGreaterThanOrEqual(10);
    expect(p.features.every((f) => f.distanceM <= 600)).toBe(true);
    expect(p.features.map((f) => f.distanceM)).toEqual(
      [...p.features.map((f) => f.distanceM)].sort((a, b) => a - b),
    );
    expect(new Set(p.features.map((f) => f.kind))).toContain("park");
    // Ids look like the Overpass ones, so the writer's id-leak check covers them.
    expect(p.features.every((f) => /^n\d{4,}$/.test(f.id))).toBe(true);
    const kinds = new Set(p.ways.map((w) => w.kind));
    for (const k of ["major", "minor", "park"]) expect(kinds).toContain(k);
    // Coordinates are [lat, lon] around the start.
    const [la, lo] = p.ways[0]!.coords[0]!;
    expect(Math.abs(la - LAT)).toBeLessThan(0.05);
    expect(Math.abs(lo - LON)).toBeLessThan(0.05);
  });

  it("fetches through TileJSON, and fails clearly when no tile arrives", async () => {
    const asked: string[] = [];
    const ok = (async (url: string | URL | Request) => {
      const u = String(url);
      asked.push(u);
      if (u.endsWith("/planet"))
        return Response.json({ tiles: ["https://tiles.example/v1/{z}/{x}/{y}.pbf"] });
      return u.endsWith(`/14/${TILE.x}/${TILE.y}.pbf`)
        ? new Response(data)
        : new Response("", { status: 404 });
    }) as typeof fetch;
    const p = await fetchTilePlaces(LAT, LON, 600, { userAgent: "test", fetchImpl: ok });
    expect(p.features.length).toBeGreaterThanOrEqual(10);
    expect(asked[0]).toBe("https://tiles.openfreemap.org/planet");

    resetTileTemplate();
    const down = (async () => new Response("", { status: 503 })) as typeof fetch;
    await expect(
      fetchTilePlaces(LAT, LON, 600, { userAgent: "test", fetchImpl: down }),
    ).rejects.toThrow(/tilejson HTTP 503/);
  });
});
