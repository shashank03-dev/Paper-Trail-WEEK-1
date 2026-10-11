/**
 * Where the hero paper goes on this screen.
 *
 * The poses below are art-directed for two reference screens: a 1280 × 800
 * laptop ("side" layout: copy and captions on the left, paper on the right)
 * and a 390 × 844 phone ("stacked": paper above, copy and captions below).
 * Real screens are anything from a landscape phone to a portrait tablet to an
 * ultrawide, so nothing is placed by fixed numbers. Each pose is mapped from
 * the region it was designed in on the reference screen to the matching
 * region measured on the live page (the space right of the copy, the space
 * above the captions…), as a uniform scale about the region's centre in
 * screen space, then projected back into the scene through the camera. The
 * choreography keeps its shape; the paper just never lands on the text or
 * outside the frame.
 *
 * Pure (no DOM), so it is unit-tested across a matrix of screens.
 */
import type { Rig } from "./StudioScene";
import { CAMERA_FOV, CAMERA_Z, DESK_Z, SHEET_H, SHEET_W } from "./foldSheet";

export type Pose = Pick<Rig, "x" | "y" | "z" | "s" | "rx" | "ry" | "rz"> & {
  fx?: number;
  fy?: number;
};
export interface Poses {
  rest: Pose;
  lift: Pose;
  flat: Pose;
  drift: Pose;
  map: Pose;
  upright: Pose;
  land: Pose;
}
export type Pen = Pick<Rig, "penX" | "penY" | "penR" | "penS" | "penOut">;

/** A box on screen, in CSS px from the top-left of the hero's viewport. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** What the page measured: the hero viewport and the boxes the paper must keep clear of. */
export interface Measure {
  vw: number;
  vh: number;
  stacked: boolean;
  /** Bottom of the floating nav. */
  nav: number;
  /** Side padding of the page. */
  gutter: number;
  /** The hero copy (headline, lede, buttons). */
  copy: Rect;
  /** The box the chapter captions appear in. */
  captions: Rect;
}

// Page 2 (the map) is the top-right panel, printed upside down. The sheet turns
// half a revolution about the map itself, so the map holds still at `at`
// while the rest of the sheet swings round it.
const mapPose = (s: number, at: [number, number]): Pose => ({
  x: at[0],
  y: at[1],
  z: 0.5,
  s,
  rx: -0.02,
  ry: 0.02,
  rz: Math.PI - 0.02,
  fx: (SHEET_W * 3) / 8,
  fy: SHEET_H / 4,
});

/** Side layout, designed on 1280 × 800. */
const SIDE: Poses = {
  rest: { x: 1.72, y: 0.05, z: 0.02, s: 1.62, rx: 0.06, ry: 0.04, rz: -0.16 },
  lift: { x: 1.45, y: -0.02, z: 0.55, s: 1.5, rx: -0.14, ry: -0.32, rz: -0.07 },
  flat: { x: 1.18, y: 0.02, z: 0.42, s: 1.02, rx: -0.08, ry: -0.06, rz: 0.015 },
  drift: { x: 1.2, y: 0.02, z: 0.45, s: 1.04, rx: -0.04, ry: 0.05, rz: 0.01 },
  map: mapPose(1.45, [1.12, -0.04]),
  upright: { x: 1.45, y: 0.0, z: 0.6, s: 1.5, rx: -0.1, ry: 0.42, rz: 0.06 },
  land: { x: 1.6, y: -0.12, z: 0.03, s: 1.45, rx: 0.04, ry: 0.0, rz: 0.16 },
};
const SIDE_PEN: Pen = { penX: 1.55, penY: -1.38, penR: 0.14, penS: 1, penOut: 1.3 };

/** Stacked layout's story poses, designed on 390 × 844 (rest is fitted to the band). */
const STACKED: Omit<Poses, "rest" | "land"> = {
  lift: { x: 0, y: 1.0, z: 0.4, s: 0.8, rx: -0.12, ry: -0.3, rz: -0.06 },
  flat: { x: 0, y: 0.86, z: 0.3, s: 0.55, rx: -0.06, ry: 0, rz: 0 },
  drift: { x: 0, y: 0.88, z: 0.32, s: 0.56, rx: -0.03, ry: 0.04, rz: 0.01 },
  map: mapPose(1.0, [0, 0.82]),
  upright: { x: 0, y: 0.82, z: 0.45, s: 1.0, rx: -0.1, ry: 0.4, rz: 0.05 },
};

/** The regions those poses were designed in, measured on the reference screens. */
const REF = {
  side: {
    vw: 1280,
    vh: 800,
    rest: { x0: 702, y0: 64, x1: 1248, y1: 800 },
    story: { x0: 534, y0: 64, x1: 1248, y1: 800 },
  },
  stacked: { vw: 390, vh: 844, story: { x0: 16, y0: 64, x1: 374, y1: 520 } },
};

const TAN = Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180);
const focal = (vh: number) => vh / 2 / TAN;
/** Camera distance to the paper at lift `z`, and to the pencil on the desk. */
const paperDepth = (z: number) => CAMERA_Z - (DESK_Z + 0.03 + z);
const DESK_DEPTH = CAMERA_Z - DESK_Z;
const w = (r: Rect) => r.x1 - r.x0;
const h = (r: Rect) => r.y1 - r.y0;

/** Maps scene positions designed in `from` (a region on a reference screen) into `to` on this one. */
function mapper(
  from: { vw: number; vh: number; r: Rect },
  to: { vw: number; vh: number; r: Rect },
) {
  const k = Math.max(0.05, Math.min(w(to.r) / w(from.r), h(to.r) / h(from.r)));
  const ff = focal(from.vh);
  const ft = focal(to.vh);
  const fc = [(from.r.x0 + from.r.x1) / 2, (from.r.y0 + from.r.y1) / 2] as const;
  const tc = [(to.r.x0 + to.r.x1) / 2, (to.r.y0 + to.r.y1) / 2] as const;
  const at = (x: number, y: number, d: number): [number, number] => {
    const px = from.vw / 2 + (x * ff) / d;
    const py = from.vh / 2 - (y * ff) / d;
    const qx = tc[0] + (px - fc[0]) * k;
    const qy = tc[1] + (py - fc[1]) * k;
    return [((qx - to.vw / 2) * d) / ft, ((to.vh / 2 - qy) * d) / ft];
  };
  const scale = (k * ff) / ft;
  return {
    pose: (p: Pose): Pose => {
      const [x, y] = at(p.x, p.y, paperDepth(p.z));
      return { ...p, x, y, s: p.s * scale };
    },
    pen: (p: Pen): Pen => {
      const [penX, penY] = at(p.penX, p.penY, DESK_DEPTH);
      return { ...p, penX, penY, penS: p.penS * scale };
    },
  };
}

/** Half the visible desk, in scene units. */
const halfH = TAN * DESK_DEPTH;

function fitSide(m: Measure): { poses: Poses; pen: Pen } {
  const right = m.vw - m.gutter;
  // Keep at least a narrow column for the paper even if the copy runs wide.
  const minW = Math.min(160, m.vw * 0.3);
  const rest = {
    x0: Math.min(m.copy.x1 + 32, right - minW),
    y0: m.nav,
    x1: right,
    y1: m.vh,
  };
  const story = {
    x0: Math.min(m.captions.x1 + 24, right - minW),
    y0: m.nav,
    x1: right,
    y1: m.vh,
  };
  const to = (r: Rect) => ({ vw: m.vw, vh: m.vh, r });
  const r = mapper({ vw: REF.side.vw, vh: REF.side.vh, r: REF.side.rest }, to(rest));
  const s = mapper({ vw: REF.side.vw, vh: REF.side.vh, r: REF.side.story }, to(story));
  const pen = r.pen(SIDE_PEN);
  return {
    poses: {
      rest: r.pose(SIDE.rest),
      land: r.pose(SIDE.land),
      lift: s.pose(SIDE.lift),
      flat: s.pose(SIDE.flat),
      drift: s.pose(SIDE.drift),
      map: s.pose(SIDE.map),
      upright: s.pose(SIDE.upright),
    },
    // Roll down until it's clear of the bottom edge.
    pen: { ...pen, penOut: pen.penY + halfH + 0.35 },
  };
}

function fitStacked(m: Measure): { poses: Poses; pen: Pen } {
  const { vw, vh } = m;
  const worldPerPx = (paperDepth(0.05) * 2 * TAN) / vh;
  const halfW = halfH * (vw / vh);
  const story = {
    x0: m.gutter,
    y0: m.nav,
    x1: vw - m.gutter,
    y1: Math.max(m.nav + 120, m.captions.y0),
  };
  const s = mapper(
    { vw: REF.stacked.vw, vh: REF.stacked.vh, r: REF.stacked.story },
    { vw, vh, r: story },
  );
  const tell = {
    lift: s.pose(STACKED.lift),
    flat: s.pose(STACKED.flat),
    drift: s.pose(STACKED.drift),
    map: s.pose(STACKED.map),
    upright: s.pose(STACKED.upright),
  };

  // The resting booklet and pencil share the band between the nav and the copy.
  const band = m.copy.y0 - m.nav - 6;
  if (band < 110) {
    // No room above the copy on this screen: the booklet waits just above the
    // frame and drops in as the story starts; the pencil sits this one out.
    const above: Pose = {
      x: 0,
      y: (vh / 2 + 200) * worldPerPx,
      z: 0.02,
      s: tell.flat.s * 1.3,
      rx: 0.05,
      ry: 0,
      rz: -0.14,
    };
    return {
      poses: {
        ...tell,
        rest: above,
        land: { ...tell.upright, s: tell.upright.s * 0.8, z: 0.03, rx: 0.04, ry: 0, rz: 0.12 },
      },
      pen: { penX: 0, penY: (vh / 2 + 300) * worldPerPx, penR: 1.05, penS: 0.001, penOut: 0 },
    };
  }
  const centreY = (vh / 2 - (m.nav + band / 2 + 2)) * worldPerPx;
  // Booklet height: most of the band, up to a phone-sized cap that grows with the screen.
  const tall = Math.min(band * 0.86, Math.min((250 * vw) / 390, vh * 0.36));
  const sc = (tall * worldPerPx) / (SHEET_H / 2);
  const rest: Pose = {
    x: (vw * 0.38 - vw / 2) * worldPerPx,
    y: centreY,
    z: 0.02,
    s: sc,
    rx: 0.05,
    ry: 0,
    rz: -0.14,
  };
  const penLen = (band * 0.92 * worldPerPx) / Math.sin(1.05);
  const penS = Math.min(0.5 * (halfW / 0.91), penLen / 1.85);
  const penX = (vw * 0.74 - vw / 2) * worldPerPx;
  return {
    poses: { ...tell, rest, land: { ...rest, z: 0.03, rz: 0.12 } },
    // Roll right until the whole pencil is past the edge.
    pen: { penX, penY: centreY, penR: 1.05, penS, penOut: halfW - penX + 0.95 * penS + 0.2 },
  };
}

export function fitStage(m: Measure): { poses: Poses; pen: Pen } {
  return m.stacked ? fitStacked(m) : fitSide(m);
}

/** Before anything is measured (first render): the side reference. */
export const DEFAULT_STAGE = fitStage({
  vw: REF.side.vw,
  vh: REF.side.vh,
  stacked: false,
  nav: 64,
  gutter: 32,
  copy: { x0: 30, y0: 61, x1: 670, y1: 739 },
  captions: { x0: 30, y0: 240, x1: 510, y1: 560 },
});
