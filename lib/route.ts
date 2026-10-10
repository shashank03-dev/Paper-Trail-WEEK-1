/**
 * Deterministic route selection (no AI). Picks 5–6 waypoints that form a loop
 * inside the time budget, prefers interesting named places, orders them
 * nearest-neighbour and then improves the loop with 2-opt.
 */
import type { Feature, Route } from "@/lib/schemas";
import { distanceM } from "@/lib/geo";

export const WALK_M_PER_MIN = 4500 / 60; // 4.5 km/h
export const STREET_FACTOR = 1.3;
/** Leave time for stopping, listening and sketching. */
export const DWELL_FACTOR = 0.82;

const INTEREST: Record<string, number> = {
  artwork: 10,
  mural: 10,
  statue: 9,
  viewpoint: 9,
  memorial: 8,
  historic: 8,
  fountain: 8,
  library: 7,
  clock: 7,
  water: 7,
  park: 3,
  garden: 6,
  wood: 6,
  man_made: 6,
  playground: 5,
  drinking_water: 5,
  bakery: 5,
  florist: 5,
  tree: 3,
  cafe: 4,
  post_box: 4,
  bench: 2,
  bus_stop: 2,
  street_lamp: 1,
  bicycle_parking: 1,
  waste_basket: 0,
};

export function interest(f: Feature): number {
  let s = INTEREST[f.kind] ?? 2;
  if (f.name) s += 3;
  if (f.kind === "tree" && (f.tags.species || f.tags.genus)) s += 3;
  return s;
}

type P = { lat: number; lon: number };
const dist = (a: P, b: P) => distanceM(a.lat, a.lon, b.lat, b.lon);

export function loopLength(start: P, pts: P[]): number {
  if (pts.length === 0) return 0;
  let L = dist(start, pts[0]!);
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1]!, pts[i]!);
  return L + dist(pts[pts.length - 1]!, start);
}

export function walkMinutes(straightM: number): number {
  return (straightM * STREET_FACTOR) / WALK_M_PER_MIN;
}

/** Straight-line budget for the whole loop. */
export function budgetM(durationMin: number): number {
  return (durationMin * DWELL_FACTOR * WALK_M_PER_MIN) / STREET_FACTOR;
}

export function nearestNeighbour<T extends P>(start: P, pts: T[]): T[] {
  const left = [...pts];
  const out: T[] = [];
  let cur: P = start;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (dist(cur, left[i]!) < dist(cur, left[bi]!)) bi = i;
    cur = left.splice(bi, 1)[0]!;
    out.push(cur as T);
  }
  return out;
}

/** 2-opt on a loop that starts and ends at `start`. */
export function twoOpt<T extends P>(start: P, pts: T[]): T[] {
  let best = [...pts];
  let bestL = loopLength(start, best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const L = loopLength(start, cand);
        if (L < bestL - 1e-6) {
          best = cand;
          bestL = L;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function selectRoute(
  features: Feature[],
  start: P,
  durationMin: number,
  opts: { max?: number; min?: number } = {},
): Route {
  const max = opts.max ?? 6;
  const min = opts.min ?? 5;
  const budget = budgetM(durationMin);
  const pool = features
    .filter((f) => interest(f) > 0 && dist(start, f) <= budget / 2 && dist(start, f) >= 25)
    .sort((a, b) => interest(b) - interest(a) || a.distanceM - b.distanceM);
  // Keep the candidate set diverse: at most 3 per kind, top 36.
  const perKind = new Map<string, number>();
  const cands: Feature[] = [];
  for (const f of pool) {
    const n = perKind.get(f.kind) ?? 0;
    if (n >= 3) continue;
    perKind.set(f.kind, n + 1);
    cands.push(f);
    if (cands.length >= 36) break;
  }

  let chosen: Feature[] = [];
  while (chosen.length < max) {
    let best: { f: Feature; order: Feature[]; value: number } | null = null;
    const kindsUsed = new Set(chosen.map((c) => c.kind));
    for (const f of cands) {
      if (chosen.includes(f)) continue;
      const order = cheapestInsert(start, chosen, f);
      const L = loopLength(start, order);
      if (L > budget) continue;
      const delta = L - loopLength(start, chosen);
      // Interesting beats near; with a bigger budget, distance matters less.
      const value =
        (interest(f) ** 1.5 * (kindsUsed.has(f.kind) ? 0.45 : 1)) / ((delta / budget) * 5 + 1);
      if (!best || value > best.value) best = { f, order, value };
    }
    if (!best) break;
    chosen = best.order;
  }

  // Thin data or a tiny budget: fill up with the nearest places so the zine still has stops.
  if (chosen.length < min) {
    const near = [...features]
      .filter((f) => !chosen.includes(f) && f.distanceM >= 15)
      .sort((a, b) => a.distanceM - b.distanceM);
    for (const f of near) {
      if (chosen.length >= min) break;
      chosen = cheapestInsert(start, chosen, f);
    }
  }
  if (chosen.length === 0) throw new Error("No mapped places nearby to build a loop from.");

  const ordered = twoOpt(start, nearestNeighbour(start, chosen));
  let prev: P = start;
  const waypoints = ordered.map((f) => {
    const leg = walkMinutes(dist(prev, f));
    prev = f;
    return { featureId: f.id, lat: f.lat, lon: f.lon, legMin: round1(leg) };
  });
  const totalM = loopLength(start, ordered);
  return {
    start: { lat: start.lat, lon: start.lon },
    waypoints,
    totalM: Math.round(totalM),
    totalMin: round1(walkMinutes(totalM)),
  };
}

function cheapestInsert<T extends P>(start: P, order: T[], f: T): T[] {
  let best = [...order, f];
  let bestL = loopLength(start, best);
  for (let i = 0; i < order.length; i++) {
    const cand = [...order.slice(0, i), f, ...order.slice(i)];
    const L = loopLength(start, cand);
    if (L < bestL) {
      best = cand;
      bestL = L;
    }
  }
  return best;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
