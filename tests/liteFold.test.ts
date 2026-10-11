import { describe, expect, it } from "vitest";
import { LITE_NX, LITE_NY, LiteFold, type Quad } from "@/components/landing/liteFold";
import { CAMERA_FOV, CAMERA_Z, DESK_Z } from "@/components/landing/foldSheet";
import type { Rig } from "@/components/landing/StudioScene";

const W = 1280;
const H = 900;
const rig = (over: Partial<Rig> = {}): Rig => ({
  top: 0,
  a: 0,
  b: 0,
  c: 0,
  x: 0,
  y: 0,
  z: 0.4,
  s: 1,
  rx: 0,
  ry: 0,
  rz: 0,
  fx: 0,
  fy: 0,
  away: 0,
  penX: 0,
  penY: 0,
  penR: 0,
  penS: 1,
  penOut: 1,
  ...over,
});

/** Settle the eased state (flex, centre) by running a couple of seconds of frames. */
function settle(r: Rig): Quad[] {
  const f = new LiteFold();
  let q: Quad[] = [];
  for (let i = 0; i < 120; i++) q = f.frame(r, 1 / 60, 0, W, H, true);
  return q;
}

const centre = (q: Quad) => [
  (q.pts[0] + q.pts[2] + q.pts[4] + q.pts[6]) / 4,
  (q.pts[1] + q.pts[3] + q.pts[5] + q.pts[7]) / 4,
];

describe("the lite (Canvas 2D) fold", () => {
  it("shows the open sheet print-side up, centred where the pose puts it", () => {
    const x = 0.6;
    const quads = settle(rig({ x }));
    expect(quads).toHaveLength(LITE_NX * LITE_NY);
    expect(quads.every((q) => q.front)).toBe(true);
    const xs = quads.flatMap((q) => [q.pts[0], q.pts[2], q.pts[4], q.pts[6]]);
    const focal = H / 2 / Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
    const expected = W / 2 + (x * focal) / (CAMERA_Z - (DESK_Z + 0.03 + 0.4));
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(expected, 0);
  });

  it("draws page 1 last when the booklet is folded, so the cover is on top", () => {
    const quads = settle(rig({ top: 1, a: 1, b: 1, c: 1, rx: 0.1, ry: 0.2, rz: 0.1 }));
    // Every cell whose centre lands near the booklet's middle: the last one drawn wins.
    const mids = quads.map(centre);
    const cx = mids.reduce((s, m) => s + m[0]!, 0) / mids.length;
    const cy = mids.reduce((s, m) => s + m[1]!, 0) / mids.length;
    const near = quads.filter((_, k) => Math.hypot(mids[k]![0]! - cx, mids[k]![1]! - cy) < 30);
    expect(near.length).toBeGreaterThan(4);
    const top = near[near.length - 1]!;
    // Page 1 is the bottom-right panel: columns 3/4 of the grid, the bottom row.
    expect(top.i).toBeGreaterThanOrEqual((LITE_NX * 3) / 4);
    expect(top.j).toBeLessThan(LITE_NY / 2);
    expect(top.front).toBe(true);
  });

  it("keeps the cover in front on a tilted booklet (no back layer bleeding through)", () => {
    // The hero's "lift" pose: tilted enough that world depth alone misorders the layers.
    const quads = settle(
      rig({
        top: 1,
        a: 1,
        b: 1,
        c: 1,
        x: 1.45,
        y: -0.02,
        z: 0.55,
        s: 1.5,
        rx: -0.14,
        ry: -0.32,
        rz: -0.07,
      }),
    );
    const inside = (p: Quad["pts"], x: number, y: number) => {
      let s = 0;
      for (let k = 0; k < 8; k += 2) {
        const c =
          (p[(k + 2) % 8]! - p[k]!) * (y - p[k + 1]!) - (p[(k + 3) % 8]! - p[k + 1]!) * (x - p[k]!);
        s += Math.sign(c);
      }
      return Math.abs(s) === 4;
    };
    const xs = quads.flatMap((q) => [q.pts[0], q.pts[2], q.pts[4], q.pts[6]]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    let hits = 0;
    for (let y = 0; y < H; y += 2) {
      let win: Quad | null = null;
      for (const q of quads) if (inside(q.pts, x, y)) win = q;
      if (!win) continue;
      hits++;
      expect(win.front).toBe(true);
      expect(win.i).toBeGreaterThanOrEqual((LITE_NX * 3) / 4);
      expect(win.j).toBeLessThan(LITE_NY / 2);
    }
    expect(hits).toBeGreaterThan(100);
  });

  it("turns the sheet over: a half turn about y shows the blank back", () => {
    const quads = settle(rig({ ry: Math.PI }));
    expect(quads.every((q) => !q.front)).toBe(true);
  });
});
