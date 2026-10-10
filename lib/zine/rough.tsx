import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";

/** rough.js defaults are tuned for pixels; the sheet is drawn in millimetres. */
const MM_DEFAULTS: Options = {
  roughness: 0.9,
  bowing: 0.6,
  maxRandomnessOffset: 0.55,
  strokeWidth: 0.35,
  hachureGap: 1.1,
  fillWeight: 0.22,
  curveStepCount: 7,
};

export type Rough = ReturnType<typeof makeRough>;

/** A seeded generator so the same trail always draws the same wobbles. */
export function makeRough(seed: number) {
  const gen = rough.generator();
  let n = 0;
  const opts = (o: Options = {}): Options => ({
    ...MM_DEFAULTS,
    seed: (seed + ++n * 7919) % 2147483647 || 1,
    ...o,
  });
  return {
    line: (x1: number, y1: number, x2: number, y2: number, o?: Options) =>
      gen.line(x1, y1, x2, y2, opts(o)),
    rect: (x: number, y: number, w: number, h: number, o?: Options) =>
      gen.rectangle(x, y, w, h, opts(o)),
    circle: (x: number, y: number, d: number, o?: Options) => gen.circle(x, y, d, opts(o)),
    ellipse: (x: number, y: number, w: number, h: number, o?: Options) =>
      gen.ellipse(x, y, w, h, opts(o)),
    linear: (pts: [number, number][], o?: Options) => gen.linearPath(pts, opts(o)),
    curve: (pts: [number, number][], o?: Options) => gen.curve(pts, opts(o)),
    polygon: (pts: [number, number][], o?: Options) => gen.polygon(pts, opts(o)),
    path: (d: string, o?: Options) => gen.path(d, opts(o)),
    toPaths: (d: Drawable) => gen.toPaths(d),
  };
}

export function RoughShape({ rc, d, className }: { rc: Rough; d: Drawable; className?: string }) {
  return (
    <g className={className}>
      {rc.toPaths(d).map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke={p.stroke === "none" ? undefined : p.stroke}
          strokeWidth={p.strokeWidth}
          fill={p.fill ?? "none"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2147483646 || 1;
}

/** Wobbles come from the trail's content, so the same trail always draws the same lines. */
export function zineSeed(d: { locationLabel: string; edition: number; date: string }): number {
  return hashSeed(`${d.locationLabel}|${d.edition}|${d.date}`);
}
