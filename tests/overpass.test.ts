import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  classify,
  dedupe,
  diversify,
  normalizeOverpass,
  overpassQuery,
  type OverpassResponse,
} from "@/lib/places/overpass";
import type { Feature } from "@/lib/schemas";

describe("Overpass normalisation", () => {
  const raw = JSON.parse(
    readFileSync("fixtures/overpass/dolores-park.json", "utf8"),
  ) as OverpassResponse;
  const out = normalizeOverpass(raw, 37.7596, -122.4269, 600);

  it("keeps features inside the radius with distance and bearing", () => {
    expect(out.features.length).toBeGreaterThan(15);
    for (const f of out.features) {
      expect(f.distanceM).toBeLessThanOrEqual(600);
      expect(f.bearingDeg).toBeGreaterThanOrEqual(0);
      expect(f.bearingDeg).toBeLessThan(360);
    }
    const hydrant = out.features.find((f) => f.name === "Golden Fire Hydrant");
    expect(hydrant?.kind).toBe("historic");
    expect(out.features.find((f) => f.name === "MaestraPeace")?.kind).toBe("mural");
  });

  it("classifies ways for drawing", () => {
    expect(out.ways.some((w) => w.kind === "park" && w.closed)).toBe(true);
    expect(out.ways.some((w) => w.kind === "major")).toBe(true);
    expect(out.ways.some((w) => w.kind === "path")).toBe(true);
  });

  it("classifies tags", () => {
    expect(classify({ tourism: "artwork", artwork_type: "mural" })).toBe("mural");
    expect(classify({ amenity: "bench" })).toBe("bench");
    expect(classify({ historic: "memorial" })).toBe("memorial");
    expect(classify({ amenity: "parking" })).toBeNull();
  });

  it("dedupes near-identical features, preferring named ones", () => {
    const a: Feature = {
      id: "n1",
      kind: "bench",
      tags: {},
      lat: 10,
      lon: 10,
      distanceM: 1,
      bearingDeg: 0,
    };
    const b: Feature = { ...a, id: "n2", name: "Memorial bench", lat: 10.00005 };
    const r = dedupe([a, b]);
    expect(r).toHaveLength(1);
    expect(r[0]!.name).toBe("Memorial bench");
  });

  it("caps at the limit while keeping a diverse mix", () => {
    const many: Feature[] = [];
    for (let i = 0; i < 300; i++)
      many.push({
        id: `n${i}`,
        kind: i < 250 ? "street_lamp" : i % 2 ? "artwork" : "bench",
        tags: {},
        lat: i * 0.001,
        lon: 0,
        distanceM: i,
        bearingDeg: 0,
      });
    const r = diversify(many, 120);
    expect(r).toHaveLength(120);
    expect(r.filter((f) => f.kind === "artwork").length).toBe(25);
  });

  it("builds an around() query with the right radius", () => {
    expect(overpassQuery(1, 2, 600)).toContain("around:600,1.000000,2.000000");
  });
});
