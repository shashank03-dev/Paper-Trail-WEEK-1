/**
 * The shelf's layout maths, kept apart from the three.js scene so the page can
 * size the shelf without loading WebGL code up front.
 */
export const ZINE_W = 1;
export const ZINE_H = 1.545; // a quarter of the landscape sheet, upright
export const GAP = 0.42;
export const ROW_H = 2.1;

export function rackSize(n: number, cols: number) {
  const c = Math.max(1, Math.min(cols, n));
  const rows = Math.max(1, Math.ceil(n / c));
  return { c, rows, w: c * ZINE_W + (c - 1) * GAP + 1.2, h: rows * ROW_H + 0.3 };
}
