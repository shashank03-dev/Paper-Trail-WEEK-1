import { describe, expect, it } from "vitest";
import { budgetM, loopLength, nearestNeighbour, selectRoute, twoOpt } from "@/lib/route";
import { presetContext } from "./helpers";
import type { Feature } from "@/lib/schemas";

describe("route selection", () => {
  it.each([10, 20, 40] as const)(
    "%s min: 5–6 distinct waypoints, loop within the time budget",
    (d) => {
      for (const i of [0, 1, 2]) {
        const { ctx, places, preset } = presetContext(i, { duration: d });
        const r = ctx.route;
        expect(r.waypoints.length).toBeGreaterThanOrEqual(5);
        expect(r.waypoints.length).toBeLessThanOrEqual(6);
        expect(new Set(r.waypoints.map((w) => w.featureId)).size).toBe(r.waypoints.length);
        const len = loopLength(preset, r.waypoints);
        expect(Math.abs(len - r.totalM)).toBeLessThan(2);
        // The walking time always fits inside the walk.
        expect(r.totalMin).toBeLessThanOrEqual(d);
        if (d > 10) expect(r.totalM).toBeLessThanOrEqual(budgetM(d) + 1);
        for (const w of r.waypoints)
          expect(places.features.some((f) => f.id === w.featureId)).toBe(true);
      }
    },
  );

  it("is deterministic", () => {
    const a = presetContext(1).ctx.route;
    const b = presetContext(1).ctx.route;
    expect(a).toEqual(b);
  });

  it("2-opt never makes a loop longer than nearest-neighbour", () => {
    const start = { lat: 0, lon: 0 };
    const pts = [
      { lat: 0.001, lon: 0.003 },
      { lat: 0.003, lon: 0.001 },
      { lat: 0.0025, lon: 0.0032 },
      { lat: -0.001, lon: 0.002 },
      { lat: 0.002, lon: -0.001 },
    ];
    const nn = nearestNeighbour(start, pts);
    expect(loopLength(start, twoOpt(start, nn))).toBeLessThanOrEqual(loopLength(start, nn) + 1e-9);
  });

  it("fills up with nearby places when interesting ones are scarce", () => {
    const f = (id: string, lat: number, kind = "bench"): Feature => ({
      id,
      kind,
      tags: {},
      lat,
      lon: 0,
      distanceM: Math.round(lat * 111000),
      bearingDeg: 0,
    });
    const r = selectRoute(
      [f("a", 0.0005), f("b", 0.001), f("c", 0.0015), f("d", 0.002), f("e", 0.0025)],
      { lat: 0, lon: 0 },
      10,
    );
    expect(r.waypoints.length).toBe(5);
  });

  it("throws when there is nothing at all", () => {
    expect(() => selectRoute([], { lat: 0, lon: 0 }, 20)).toThrow();
  });
});
