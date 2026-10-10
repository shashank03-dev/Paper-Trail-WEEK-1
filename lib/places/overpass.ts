import type { Feature, Places, Way } from "@/lib/schemas";
import { bearingDeg, distanceM, simplify } from "@/lib/geo";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}
export interface OverpassResponse {
  elements: OverpassElement[];
}

export function overpassQuery(lat: number, lon: number, radiusM: number): string {
  const a = `(around:${Math.round(radiusM)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  return `[out:json][timeout:25];
(
  node${a}[amenity~"^(bench|drinking_water|post_box|fountain|library|cafe|bicycle_parking|clock|waste_basket)$"];
  nwr${a}[leisure~"^(park|playground|garden)$"];
  node${a}[natural=tree];
  nwr${a}[natural~"^(water|wood)$"];
  nwr${a}[tourism~"^(artwork|viewpoint)$"];
  nwr${a}[historic];
  node${a}[highway~"^(bus_stop|street_lamp)$"];
  nwr${a}[man_made~"^(tower|water_tower|lighthouse|flagpole|obelisk|windmill|bridge|clock|water_well|cross|watermill|telescope|chimney)$"];
  nwr${a}[shop~"^(bakery|florist)$"];
  way${a}[highway~"^(residential|tertiary|secondary|primary|living_street|pedestrian|footway|path|cycleway|service)$"];
);
out geom 3000;`;
}

const KEEP_TAGS = [
  "name",
  "species",
  "genus",
  "leaf_type",
  "artwork_type",
  "artist_name",
  "historic",
  "memorial",
  "inscription",
  "material",
  "colour",
  "start_date",
  "subject",
  "height",
  "man_made",
  "cuisine",
];

/** What kind of interesting thing is this, if any? */
export function classify(tags: Record<string, string>): string | null {
  const t = tags;
  if (t.tourism === "artwork")
    return t.artwork_type === "mural"
      ? "mural"
      : t.artwork_type === "statue"
        ? "statue"
        : "artwork";
  if (t.tourism === "viewpoint") return "viewpoint";
  if (t.historic)
    return t.historic === "memorial" || t.historic === "monument" ? "memorial" : "historic";
  if (
    t.amenity &&
    /^(bench|drinking_water|post_box|fountain|library|cafe|bicycle_parking|clock|waste_basket)$/.test(
      t.amenity,
    )
  )
    return t.amenity;
  if (t.leisure && /^(park|playground|garden)$/.test(t.leisure)) return t.leisure;
  if (t.natural === "tree") return "tree";
  if (t.natural === "water" || t.natural === "wood") return t.natural;
  if (t.highway === "bus_stop" || t.highway === "street_lamp") return t.highway;
  if (t.man_made) return "man_made";
  if (t.shop === "bakery" || t.shop === "florist") return t.shop;
  return null;
}

function wayKind(tags: Record<string, string>): Way["kind"] | null {
  const h = tags.highway;
  if (h) {
    if (/^(primary|secondary|tertiary)$/.test(h)) return "major";
    if (/^(residential|living_street|service|pedestrian)$/.test(h)) return "minor";
    if (/^(footway|path|cycleway)$/.test(h)) return "path";
  }
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  if (tags.natural === "water") return "water";
  return null;
}

export const MAX_FEATURES = 120;

/** Priority of kinds when we have to drop features to stay under the cap. */
const KIND_PRIORITY: Record<string, number> = {
  artwork: 10,
  mural: 10,
  statue: 9,
  viewpoint: 9,
  memorial: 9,
  historic: 8,
  fountain: 8,
  library: 7,
  clock: 7,
  park: 7,
  garden: 7,
  water: 7,
  playground: 6,
  wood: 6,
  man_made: 6,
  tree: 5,
  drinking_water: 5,
  bakery: 5,
  florist: 5,
  cafe: 4,
  post_box: 4,
  bench: 3,
  bus_stop: 3,
  bicycle_parking: 2,
  street_lamp: 2,
  waste_basket: 1,
};

export function normalizeOverpass(
  raw: OverpassResponse,
  lat: number,
  lon: number,
  radiusM: number,
): Places {
  const feats: Feature[] = [];
  const ways: Way[] = [];
  for (const el of raw.elements) {
    const tags = el.tags ?? {};
    const kind = classify(tags);
    const geom = el.geometry?.map((p) => [p.lat, p.lon] as [number, number]);
    if (kind) {
      const pt =
        el.lat !== undefined && el.lon !== undefined
          ? { lat: el.lat, lon: el.lon }
          : (el.center ?? (geom && centroid(geom)));
      if (pt) {
        const d = distanceM(lat, lon, pt.lat, pt.lon);
        if (d <= radiusM) {
          const sub: Record<string, string> = {};
          for (const key of KEEP_TAGS) if (tags[key]) sub[key] = tags[key]!.slice(0, 40);
          feats.push({
            id: `${el.type[0]}${el.id}`,
            kind,
            ...(tags.name ? { name: tags.name.slice(0, 48) } : {}),
            tags: sub,
            lat: round6(pt.lat),
            lon: round6(pt.lon),
            distanceM: Math.round(d),
            bearingDeg: Math.round(bearingDeg(lat, lon, pt.lat, pt.lon)),
          });
        }
      }
    }
    const wk = wayKind(tags);
    if (wk && geom && geom.length >= 2) {
      const near = geom.some(([la, lo]) => distanceM(lat, lon, la, lo) <= radiusM * 1.2);
      if (!near) continue;
      const closed =
        geom.length > 3 &&
        geom[0]![0] === geom[geom.length - 1]![0] &&
        geom[0]![1] === geom[geom.length - 1]![1];
      const clipped = closed ? [geom] : clipToRadius(geom, lat, lon, radiusM * 1.6);
      for (const part of clipped) {
        const coords = simplify(part, wk === "park" || wk === "water" ? 4 : 2.5).map(
          ([a, b]) => [round6(a), round6(b)] as [number, number],
        );
        if (coords.length < 2) continue;
        ways.push({
          id: `w${el.id}${clipped.length > 1 ? `-${ways.length}` : ""}`,
          kind: wk,
          ...(tags.name ? { name: tags.name.slice(0, 40) } : {}),
          closed,
          coords,
        });
      }
    }
  }
  return { features: diversify(dedupe(feats), MAX_FEATURES), ways: ways.slice(0, 700) };
}

/** Same kind within 15 m → keep one (prefer named). */
export function dedupe(fs: Feature[]): Feature[] {
  const out: Feature[] = [];
  const sorted = [...fs].sort((a, b) => Number(!!b.name) - Number(!!a.name));
  for (const f of sorted) {
    const dup = out.find(
      (o) =>
        o.kind === f.kind &&
        distanceM(o.lat, o.lon, f.lat, f.lon) < 15 &&
        (!o.name || !f.name || o.name === f.name),
    );
    if (!dup) out.push(f);
  }
  return out;
}

/** Keep a diverse mix by kind: round-robin over kinds (by priority), named and near first. */
export function diversify(fs: Feature[], cap: number): Feature[] {
  if (fs.length <= cap) return [...fs].sort((a, b) => a.distanceM - b.distanceM);
  const groups = new Map<string, Feature[]>();
  for (const f of fs) groups.set(f.kind, [...(groups.get(f.kind) ?? []), f]);
  for (const g of groups.values())
    g.sort((a, b) => Number(!!b.name) - Number(!!a.name) || a.distanceM - b.distanceM);
  const kinds = [...groups.keys()].sort(
    (a, b) => (KIND_PRIORITY[b] ?? 3) - (KIND_PRIORITY[a] ?? 3),
  );
  const out: Feature[] = [];
  let round = 0;
  while (out.length < cap) {
    let added = false;
    for (const k of kinds) {
      const g = groups.get(k)!;
      // High-priority kinds get two picks per round.
      const take = (KIND_PRIORITY[k] ?? 3) >= 7 ? 2 : 1;
      for (let i = 0; i < take && out.length < cap; i++) {
        const f = g[round * take + i];
        if (f) {
          out.push(f);
          added = true;
        }
      }
    }
    if (!added) break;
    round++;
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

function clipToRadius(
  geom: [number, number][],
  lat: number,
  lon: number,
  r: number,
): [number, number][][] {
  const parts: [number, number][][] = [];
  let cur: [number, number][] = [];
  for (const p of geom) {
    if (distanceM(lat, lon, p[0], p[1]) <= r) cur.push(p);
    else {
      if (cur.length) cur.push(p);
      if (cur.length >= 2) parts.push(cur);
      cur = [];
    }
  }
  if (cur.length >= 2) parts.push(cur);
  return parts;
}

function centroid(g: [number, number][]): { lat: number; lon: number } {
  let la = 0;
  let lo = 0;
  for (const [a, b] of g) {
    la += a;
    lo += b;
  }
  return { lat: la / g.length, lon: lo / g.length };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
