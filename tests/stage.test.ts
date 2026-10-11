import { describe, expect, it } from "vitest";
import { fitStage, type Measure, type Pose } from "@/components/landing/stage";
import { LiteFold } from "@/components/landing/liteFold";
import { CAMERA_FOV, CAMERA_Z, DESK_Z } from "@/components/landing/foldSheet";
import type { Rig } from "@/components/landing/StudioScene";

/*
 * Layouts measured on the real page (viewport, gutter, hero copy, caption box),
 * from a small phone to an ultrawide, portrait tablets and phones on their side.
 * [vw, vh, stacked, gutter, copy x0 y0 x1 y1, captions x0 y0 x1 y1]
 */
const SCREENS: [number, number, boolean, number, number[], number[]][] = [
  [320, 568, true, 16, [16, 80, 304, 517], [16, 267, 304, 523]],
  [375, 667, true, 16, [16, 205, 359, 607], [16, 358, 359, 614]],
  [393, 852, true, 16, [16, 297, 377, 775], [16, 528, 377, 784]],
  [780, 360, false, 22, [22, 93, 443, 268], [22, 180, 365, 500]],
  [852, 340, false, 23, [23, 86, 483, 255], [23, 170, 398, 490]],
  [884, 1104, true, 24, [24, 497, 664, 1005], [24, 760, 504, 1016]],
  [1080, 1753, true, 27, [27, 1054, 667, 1595], [27, 1357, 507, 1613]],
  [1024, 1366, true, 26, [26, 712, 666, 1244], [26, 1001, 506, 1257]],
  [1180, 820, false, 28, [28, 82, 665, 739], [28, 410, 508, 730]],
  [1280, 720, false, 30, [30, 64, 670, 686], [30, 360, 510, 680]],
  [1280, 800, false, 30, [30, 61, 670, 739], [30, 400, 510, 720]],
  [1000, 950, true, 26, [26, 337, 666, 865], [26, 618, 506, 874]],
  [1100, 980, false, 27, [27, 171, 621, 809], [27, 490, 507, 810]],
  [1920, 1080, false, 32, [352, 176, 992, 904], [352, 540, 832, 860]],
  [3440, 1440, false, 32, [1112, 356, 1752, 1084], [1112, 720, 1592, 1040]],
];
const rect = ([x0, y0, x1, y1]: number[]) => ({ x0: x0!, y0: y0!, x1: x1!, y1: y1! });
const measure = ([vw, vh, stacked, gutter, copy, captions]: (typeof SCREENS)[number]): Measure => ({
  vw,
  vh,
  stacked,
  gutter,
  nav: 70,
  copy: rect(copy),
  captions: rect(captions),
});

/** The paper's on-screen box in a pose, folded or open, as the renderers draw it. */
function box(p: Pose, folded: boolean, vw: number, vh: number) {
  const f = folded ? 1 : 0;
  const rig: Rig = {
    fx: 0,
    fy: 0,
    ...p,
    top: f,
    a: f,
    b: f,
    c: f,
    away: 0,
    penX: 0,
    penY: 0,
    penR: 0,
    penS: 1,
    penOut: 1,
  };
  const fold = new LiteFold();
  let q = fold.frame(rig, 1 / 60, 0, vw, vh, true);
  for (let i = 0; i < 90; i++) q = fold.frame(rig, 1 / 60, 0, vw, vh, true);
  const xs = q.flatMap((c) => [c.pts[0], c.pts[2], c.pts[4], c.pts[6]]);
  const ys = q.flatMap((c) => [c.pts[1], c.pts[3], c.pts[5], c.pts[7]]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
type Box = ReturnType<typeof box>;
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const name = (s: (typeof SCREENS)[number]) => `${s[0]}×${s[1]}`;

describe("fitting the hero paper to the screen", () => {
  for (const s of SCREENS) {
    const m = measure(s);
    const { poses, pen } = fitStage(m);

    it(`${name(s)}: the resting booklet sits clear of the copy, inside the frame (or waits above it)`, () => {
      const b = box(poses.rest, true, m.vw, m.vh);
      if (b.y1 <= 0) return; // no room above the copy: it drops in when the story starts
      expect(overlaps(b, m.copy)).toBe(false);
      expect(b.x0).toBeGreaterThanOrEqual(0);
      expect(b.x1).toBeLessThanOrEqual(m.vw);
      expect(b.y0).toBeGreaterThanOrEqual(m.nav - 8);
      expect(b.y1).toBeLessThanOrEqual(m.vh);
    });

    it(`${name(s)}: the open sheet fits the frame beside or above the captions`, () => {
      for (const p of [poses.flat, poses.drift]) {
        const b = box(p, false, m.vw, m.vh);
        expect(b.x0).toBeGreaterThanOrEqual(-1);
        expect(b.x1).toBeLessThanOrEqual(m.vw + 1);
        expect(b.y0).toBeGreaterThanOrEqual(m.nav - 12);
        if (m.stacked) expect(b.y1).toBeLessThanOrEqual(m.captions.y0 + 12);
        else expect(b.x0).toBeGreaterThanOrEqual(m.captions.x1);
        // And it is big enough to read as the hero (short phones are height-bound).
        const stageH = (m.stacked ? m.captions.y0 : m.vh) - m.nav;
        const fills = Math.max((b.x1 - b.x0) / m.vw, (b.y1 - b.y0) / stageH);
        expect(fills).toBeGreaterThan(m.stacked ? 0.45 : 0.25);
      }
    });

    it(`${name(s)}: the booklet lands in frame, clear of the last caption`, () => {
      const b = box(poses.land, true, m.vw, m.vh);
      expect(b.x0).toBeGreaterThanOrEqual(0);
      expect(b.x1).toBeLessThanOrEqual(m.vw);
      expect(b.y0).toBeGreaterThanOrEqual(m.nav - 12);
      if (m.stacked) expect(b.y1).toBeLessThanOrEqual(m.captions.y0 + 12);
      else expect(b.x0).toBeGreaterThanOrEqual(m.captions.x1);
    });

    it(`${name(s)}: the pencil rolls all the way out of frame`, () => {
      if (pen.penS < 0.01) return; // it sits this screen out
      const halfH = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180) * (CAMERA_Z - DESK_Z);
      const halfW = (halfH * m.vw) / m.vh;
      const x = pen.penX + (m.stacked ? pen.penOut : 0);
      const y = pen.penY - (m.stacked ? 0 : pen.penOut);
      // Both ends of the pencil (it is about 1.9 long at scale 1).
      for (const e of [-1, 1]) {
        const ex = x + Math.cos(pen.penR) * 0.95 * pen.penS * e;
        const ey = y + Math.sin(pen.penR) * 0.95 * pen.penS * e;
        expect(Math.abs(ex) > halfW || Math.abs(ey) > halfH).toBe(true);
      }
    });
  }
});

describe("the stacked layout query", () => {
  it("is the same in CSS (the stacked: variant) and in the script that fits the paper", async () => {
    const { readFileSync } = await import("node:fs");
    const { STACKED_QUERY } = await import("@/lib/client/layout");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(`@custom-variant stacked (@media ${STACKED_QUERY});`);
  });
});
