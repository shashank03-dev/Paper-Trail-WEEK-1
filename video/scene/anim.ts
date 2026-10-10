/**
 * Time is the only input. Every value in the film is a pure function of t
 * (seconds), so any frame can be rendered in any order.
 */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0 → 1 as t goes from a to b. */
export const prog = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export type Ease = (k: number) => number;
export const linear: Ease = (k) => k;
export const inOutSine: Ease = (k) => -(Math.cos(Math.PI * k) - 1) / 2;
export const inOutCubic: Ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
export const inOutQuad: Ease = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
export const outCubic: Ease = (k) => 1 - (1 - k) ** 3;
export const inCubic: Ease = (k) => k * k * k;
export const outExpo: Ease = (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k));
export const outQuart: Ease = (k) => 1 - (1 - k) ** 4;
/** The brand's paper curve, cubic-bezier(0.3, 0.7, 0.1, 1), solved numerically. */
export const paper: Ease = bezier(0.3, 0.7, 0.1, 1);
export const expo: Ease = bezier(0.16, 1, 0.3, 1);

export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  return (k) => {
    if (k <= 0) return 0;
    if (k >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let u = k;
    for (let i = 0; i < 30; i++) {
      const x = sx(u);
      if (Math.abs(x - k) < 1e-6) break;
      if (x < k) lo = u;
      else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

/**
 * Critically damped spring step response: starts at 0 at t0, settles at 1,
 * never overshoots. `w` is the natural frequency (higher = snappier).
 */
export function spring(t: number, t0: number, w = 18): number {
  if (t <= t0) return 0;
  const x = (t - t0) * w;
  return 1 - (1 + x) * Math.exp(-x);
}

/** A keyframed track: [time, value] pairs, each segment with its own ease. */
export type Key = [number, number] | [number, number, Ease];
export function track(t: number, keys: Key[]): number {
  const first = keys[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t <= k[0]) {
      const p = keys[i - 1]!;
      const e = k[2] ?? inOutCubic;
      return lerp(p[1], k[1], e(prog(t, p[0], k[0])));
    }
  }
  return keys[keys.length - 1]![1];
}

/** Several tracks that share key times, as one object. */
export function pose<K extends string>(
  t: number,
  keys: [number, Record<K, number>, Ease?][],
): Record<K, number> {
  const out = {} as Record<K, number>;
  const names = Object.keys(keys[0]![1]) as K[];
  for (const n of names)
    out[n] = track(
      t,
      keys.map(([at, v, e]) => (e ? [at, v[n], e] : [at, v[n]]) as Key),
    );
  return out;
}

/** Deterministic hash noise in [0, 1). */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
