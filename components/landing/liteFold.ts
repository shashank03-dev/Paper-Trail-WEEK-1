/**
 * The hero fold without WebGL. Same paper, same choreography: the sheet is
 * bent by `foldVertices` from the same `Rig` the anime.js timeline drives, then
 * projected through the same camera and drawn with Canvas 2D, one textured
 * quad per grid cell, back to front. It is what devices that can't (or
 * shouldn't) run three.js see, so nobody gets a flat picture instead of the fold.
 *
 * Kept free of three.js so the lite path never downloads it.
 */
import type { Rig } from "./StudioScene";
import {
  CAMERA_FOV,
  CAMERA_Z,
  DESK_Z,
  SHEET_H,
  SHEET_W,
  foldVertices,
  footprintCentre,
} from "./foldSheet";

/** Grid resolution. Multiples of 4 × 2, so every crease falls on a cell edge
 * and a folded cell lands exactly on its mirror (clean depth order). */
export const LITE_NX = 24;
export const LITE_NY = 12;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
// Same key light as the WebGL scene, pointing from the paper toward the light.
const LIGHT = (() => {
  const v = [-3.2, 3.6, 6.5];
  const l = Math.hypot(v[0]!, v[1]!, v[2]!);
  return v.map((c) => c / l) as [number, number, number];
})();

export interface Quad {
  /** Screen corners (device px): bottom-left, bottom-right, top-right, top-left of the cell. */
  pts: [number, number, number, number, number, number, number, number];
  /** Shadow corners on the desk (device px), same order. */
  shadow: [number, number, number, number, number, number, number, number];
  /** Grid cell. */
  i: number;
  j: number;
  /** Draw order key (larger = drawn later, nearer the camera). */
  z: number;
  /** True when the printed side faces the camera. */
  front: boolean;
  /** 0..0.3: how much darker than full light this cell is. */
  shade: number;
}

/** The paper's state between frames (fold speed → flex, eased centre). */
export class LiteFold {
  readonly flat: Float32Array;
  readonly pos: Float32Array;
  private prev: number[] | null = null;
  private flex = 0;
  private cx = 0;
  private cy = 0;
  private settled = false;

  constructor(
    readonly nx = LITE_NX,
    readonly ny = LITE_NY,
  ) {
    this.flat = new Float32Array((nx + 1) * (ny + 1) * 2);
    this.pos = new Float32Array((nx + 1) * (ny + 1) * 3);
    let k = 0;
    for (let j = 0; j <= ny; j++)
      for (let i = 0; i <= nx; i++) {
        this.flat[k++] = -SHEET_W / 2 + (SHEET_W * i) / nx;
        this.flat[k++] = -SHEET_H / 2 + (SHEET_H * j) / ny;
      }
  }

  /** True while flex or the centre are still easing toward rest. */
  get moving(): boolean {
    return !this.settled;
  }

  /**
   * Advance one frame and return the quads to draw, back to front.
   * `w`/`h` are the canvas size in device px; `t` is seconds since start.
   */
  frame(r: Rig, dt: number, t: number, w: number, h: number, still: boolean): Quad[] {
    const step = Math.max(1e-3, Math.min(dt, 0.05));
    const folds = [r.top, r.a, r.b, r.c];
    const prev = this.prev;
    const speed = prev ? Math.max(...folds.map((f, i) => Math.abs(f - prev[i]!))) / step : 0;
    this.prev = folds;
    const target = still ? 0 : clamp01(speed * 0.9);
    const flex0 = this.flex;
    this.flex += (target - this.flex) * (1 - Math.pow(0.02, step));
    if (Math.abs(target - this.flex) < 1e-4) this.flex = target;

    foldVertices(this.flat, this.pos, { top: r.top, a: r.a, b: r.b, c: r.c, flex: this.flex });
    const [fcx, fcy] = footprintCentre(this.pos);
    const k = 1 - Math.pow(0.0004, step);
    const cx0 = this.cx;
    const cy0 = this.cy;
    if (prev === null) {
      this.cx = fcx;
      this.cy = fcy;
    } else {
      this.cx += (fcx - this.cx) * k;
      this.cy += (fcy - this.cy) * k;
    }
    this.settled =
      Math.abs(this.flex - flex0) < 1e-4 &&
      Math.abs(this.cx - cx0) < 1e-4 &&
      Math.abs(this.cy - cy0) < 1e-4;

    const lift = clamp01(r.z / 0.4);
    const bob = still ? 0 : Math.sin(t * 0.8) * 0.016 * lift;
    const rz = r.rz + (still ? 0 : Math.sin(t * 0.45) * 0.008 * lift);
    return this.project(r, bob, rz, w, h);
  }

  private project(r: Rig, bob: number, rz: number, w: number, h: number): Quad[] {
    const { nx, ny, pos } = this;
    const n = (nx + 1) * (ny + 1);
    const focal = h / 2 / Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
    const [sa, ca] = [Math.sin(r.rx), Math.cos(r.rx)];
    const [sb, cb] = [Math.sin(r.ry), Math.cos(r.ry)];
    const [sg, cg] = [Math.sin(rz), Math.cos(rz)];
    const ox = r.x;
    const oy = r.y + bob;
    const oz = DESK_Z + 0.03 + r.z;
    // World positions (three.js order: scale, Euler XYZ = Rz then Ry then Rx, translate).
    const world = new Float32Array(n * 3);
    const scr = new Float32Array(n * 2);
    const sh = new Float32Array(n * 2);
    for (let v = 0; v < n; v++) {
      const x0 = (pos[v * 3]! - this.cx - r.fx) * r.s;
      const y0 = (pos[v * 3 + 1]! - this.cy - r.fy) * r.s;
      const z0 = pos[v * 3 + 2]! * r.s;
      const x1 = x0 * cg - y0 * sg;
      const y1 = x0 * sg + y0 * cg;
      const x2 = x1 * cb + z0 * sb;
      const z2 = -x1 * sb + z0 * cb;
      const y3 = y1 * ca - z2 * sa;
      const z3 = y1 * sa + z2 * ca;
      const X = x2 + ox;
      const Y = y3 + oy;
      const Z = z3 + oz;
      world[v * 3] = X;
      world[v * 3 + 1] = Y;
      world[v * 3 + 2] = Z;
      const d = CAMERA_Z - Z;
      scr[v * 2] = w / 2 + (X * focal) / d;
      scr[v * 2 + 1] = h / 2 - (Y * focal) / d;
      // Its shadow on the desk, cast along the key light.
      // (A flap swinging below the desk plane casts nothing onto it.)
      const u = Math.max(0, Z - DESK_Z) / LIGHT[2];
      const dz = CAMERA_Z - DESK_Z;
      sh[v * 2] = w / 2 + ((X - LIGHT[0] * u) * focal) / dz;
      sh[v * 2 + 1] = h / 2 - ((Y - LIGHT[1] * u) * focal) / dz;
    }

    // Which side of the sheet the camera sees: its normal (local +z) after rotation.
    const sheetN = [sb, -sa * cb, ca * cb];
    const facing = sheetN[0]! * -ox + sheetN[1]! * -oy + sheetN[2]! * (CAMERA_Z - oz) >= 0 ? 1 : -1;

    const quads: Quad[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i; // bottom-left
        const b = a + 1; // bottom-right
        const c = a + nx + 2; // top-right
        const d = a + nx + 1; // top-left
        // Normal from the diagonals (points toward the printed side).
        const e1 = [0, 1, 2].map((q) => world[c * 3 + q]! - world[a * 3 + q]!);
        const e2 = [0, 1, 2].map((q) => world[d * 3 + q]! - world[b * 3 + q]!);
        let nX = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
        let nY = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
        let nZ = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
        const nl = Math.hypot(nX, nY, nZ) || 1;
        nX /= nl;
        nY /= nl;
        nZ /= nl;
        const mx = (world[a * 3]! + world[b * 3]! + world[c * 3]! + world[d * 3]!) / 4;
        const my =
          (world[a * 3 + 1]! + world[b * 3 + 1]! + world[c * 3 + 1]! + world[d * 3 + 1]!) / 4;
        const mz =
          (world[a * 3 + 2]! + world[b * 3 + 2]! + world[c * 3 + 2]! + world[d * 3 + 2]!) / 4;
        const front = nX * -mx + nY * -my + nZ * (CAMERA_Z - mz) > 0;
        const sgn = front ? 1 : -1;
        const lambert = Math.max(0, sgn * (nX * LIGHT[0] + nY * LIGHT[1] + nZ * LIGHT[2]));
        quads.push({
          pts: [
            scr[a * 2]!,
            scr[a * 2 + 1]!,
            scr[b * 2]!,
            scr[b * 2 + 1]!,
            scr[c * 2]!,
            scr[c * 2 + 1]!,
            scr[d * 2]!,
            scr[d * 2 + 1]!,
          ],
          shadow: [
            sh[a * 2]!,
            sh[a * 2 + 1]!,
            sh[b * 2]!,
            sh[b * 2 + 1]!,
            sh[c * 2]!,
            sh[c * 2 + 1]!,
            sh[d * 2]!,
            sh[d * 2 + 1]!,
          ],
          i,
          j,
          // Folded layers sit only ~0.01 apart, less than a tilted sheet's depth
          // changes across one row, so order by height in the sheet's own frame
          // (the stacking axis), toward the camera; world depth only breaks ties.
          z:
            (facing * (pos[a * 3 + 2]! + pos[b * 3 + 2]! + pos[c * 3 + 2]! + pos[d * 3 + 2]!)) / 4 +
            mz * 1e-3,
          front,
          shade: 0.3 * clamp01((0.85 - lambert) / 0.85),
        });
      }
    // Painter's order: farthest first.
    quads.sort((p, q) => p.z - q.z);
    return quads;
  }
}

/* ------------------------------ drawing ------------------------------ */

// The print as the WebGL scene shows it under its warm key light.
const WARM = "#f5ecde";
const PAPER = WARM;
const BACK = "#ede4d3";
const SHADE = "58,46,30";

/** Grow a quad by `g` px away from its centre so neighbours overlap (no hairline seams). */
function grow(p: Quad["pts"], g: number): number[] {
  const mx = (p[0] + p[2] + p[4] + p[6]) / 4;
  const my = (p[1] + p[3] + p[5] + p[7]) / 4;
  const out: number[] = [];
  for (let k = 0; k < 8; k += 2) {
    const dx = p[k]! - mx;
    const dy = p[k + 1]! - my;
    const l = Math.hypot(dx, dy) || 1;
    out.push(p[k]! + (dx / l) * g, p[k + 1]! + (dy / l) * g);
  }
  return out;
}

let filterOk: boolean | null = null;
/** Canvas `filter` (blur) exists in Chromium and Firefox, not in older Safari. */
const canFilter = () =>
  (filterOk ??=
    typeof CanvasRenderingContext2D !== "undefined" &&
    "filter" in CanvasRenderingContext2D.prototype);

/**
 * The paper's soft shadow on the desk. It is drawn on-canvas into a small
 * buffer and scaled up: blurred with the canvas filter where there is one,
 * otherwise softened by drawing it coarser (bilinear upscaling blurs it). The
 * shape is never drawn off-canvas to borrow its `shadowBlur`, so nothing can
 * leak onto the page however far the paper sits from the centre.
 */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  buf: HTMLCanvasElement,
  quads: Quad[],
  lift: number,
): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const blur = 5 + 28 * lift; // device px
  const filter = canFilter();
  const q = filter ? 4 : Math.min(14, Math.max(4, Math.round(blur / 2.5)));
  const bw = Math.max(1, Math.ceil(W / q));
  const bh = Math.max(1, Math.ceil(H / q));
  if (buf.width !== bw || buf.height !== bh) {
    buf.width = bw;
    buf.height = bh;
  }
  const b = buf.getContext("2d");
  if (!b) return;
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.clearRect(0, 0, bw, bh);
  if (filter) b.filter = `blur(${(blur / q).toFixed(2)}px)`;
  b.fillStyle = `rgba(${SHADE},${(0.2 - 0.06 * lift).toFixed(3)})`;
  b.beginPath();
  for (const quad of quads) {
    const s = quad.shadow;
    // Same winding for every cell, so the nonzero fill is their union.
    const area = (s[2] - s[0]) * (s[7] - s[1]) - (s[6] - s[0]) * (s[3] - s[1]);
    const order = area >= 0 ? [0, 2, 4, 6] : [6, 4, 2, 0];
    order.forEach((k, n) => {
      const x = s[k]! / q;
      const y = s[k + 1]! / q;
      if (n === 0) b.moveTo(x, y);
      else b.lineTo(x, y);
    });
    b.closePath();
  }
  b.fill();
  if (filter) b.filter = "none";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(buf, 0, 0, bw, bh, 0, 0, bw * q, bh * q);
}

/**
 * Draw the paper. `img` is the printed sheet (or null while it rasterises:
 * the paper shows blank). Each cell is clipped to its projected outline and
 * the matching piece of the print is mapped onto it with the affine transform
 * that best fits its four corners.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  quads: Quad[],
  img: CanvasImageSource | null,
  iw: number,
  ih: number,
  nx = LITE_NX,
  ny = LITE_NY,
): void {
  const du = iw / nx;
  const dv = ih / ny;
  for (const q of quads) {
    const p = q.pts;
    const g = grow(p, 0.7);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g[0]!, g[1]!);
    ctx.lineTo(g[2]!, g[3]!);
    ctx.lineTo(g[4]!, g[5]!);
    ctx.lineTo(g[6]!, g[7]!);
    ctx.closePath();
    if (q.front && img) {
      ctx.clip();
      // Texture space: x right, y down; cell (i, j) counts rows from the bottom.
      const u0 = q.i * du;
      const vTop = (ny - 1 - q.j) * dv;
      // Mean edge vectors per unit of texture, then match the centres.
      const ax = (p[2] - p[0] + (p[4] - p[6])) / 2 / du;
      const ay = (p[3] - p[1] + (p[5] - p[7])) / 2 / du;
      const cx = (p[6] - p[0] + (p[4] - p[2])) / 2 / dv; // bottom → top is −v
      const cy = (p[7] - p[1] + (p[5] - p[3])) / 2 / dv;
      const mx = (p[0] + p[2] + p[4] + p[6]) / 4;
      const my = (p[1] + p[3] + p[5] + p[7]) / 4;
      const su = u0 + du / 2;
      const sv = vTop + dv / 2;
      // u → +a, v → −c (texture v grows downward while the cell's "up" is −v).
      ctx.transform(ax, ay, -cx, -cy, mx - ax * su + cx * sv, my - ay * su + cy * sv);
      const pad = 1.5;
      const sx = Math.max(0, u0 - pad);
      const sy = Math.max(0, vTop - pad);
      const sw = Math.min(iw, u0 + du + pad) - sx;
      const shh = Math.min(ih, vTop + dv + pad) - sy;
      ctx.drawImage(img, sx, sy, sw, shh, sx, sy, sw, shh);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = WARM;
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      if (q.shade > 0.01) {
        ctx.fillStyle = `rgba(${SHADE},${q.shade})`;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = q.front ? PAPER : BACK;
      ctx.fill();
      if (q.shade > 0.01) {
        ctx.fillStyle = `rgba(${SHADE},${q.shade})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

/** The riso-blue HB pencil, seen from above, rolling as it travels. */
export function drawPencil(
  ctx: CanvasRenderingContext2D,
  r: Rig,
  stacked: boolean,
  w: number,
  h: number,
): void {
  if (r.penS < 0.01) return;
  const R = 0.05;
  const L = 1.55;
  const travel = r.away * r.penOut;
  const X = r.penX + (stacked ? travel : 0);
  const Y = r.penY - (stacked ? 0 : travel);
  const Z = DESK_Z + R * r.penS;
  const focal = h / 2 / Math.tan((CAMERA_FOV / 2) * (Math.PI / 180));
  const d = CAMERA_Z - Z;
  const sx = w / 2 + (X * focal) / d;
  const sy = h / 2 - (Y * focal) / d;
  const k = (focal / d) * r.penS;
  const roll = (stacked ? -1 : 1) * (travel / (R * r.penS));

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-r.penR);
  ctx.scale(k, -k);
  // Local units now: +x toward the tip, +y up the page.
  // Contact shadow, falling away from the light.
  ctx.save();
  ctx.translate(0.035, -0.045);
  ctx.fillStyle = `rgba(${SHADE},0.16)`;
  ctx.beginPath();
  ctx.moveTo(-L / 2 - 0.18, -R);
  ctx.lineTo(L / 2, -R);
  ctx.lineTo(L / 2 + 0.19, 0);
  ctx.lineTo(L / 2, R);
  ctx.lineTo(-L / 2 - 0.18, R);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Lacquered hexagonal body; the facet lines turn with the roll.
  const body = ctx.createLinearGradient(0, -R, 0, R);
  body.addColorStop(0, "#1f2ea8");
  body.addColorStop(0.55, "#2b3dd8");
  body.addColorStop(0.8, "#5868ec");
  body.addColorStop(1, "#2433bf");
  ctx.fillStyle = body;
  ctx.fillRect(-L / 2, -R, L, 2 * R);
  ctx.strokeStyle = "rgba(10,18,90,0.35)";
  ctx.lineWidth = 0.004;
  for (let f = 0; f < 6; f++) {
    const a = roll + (f * Math.PI) / 3;
    if (Math.cos(a) <= 0) continue; // facet edge on the hidden side
    const y = R * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(-L / 2, y);
    ctx.lineTo(L / 2, y);
    ctx.stroke();
  }
  // Sharpened wood and the lead.
  ctx.fillStyle = "#e2c294";
  ctx.beginPath();
  ctx.moveTo(L / 2, -R);
  ctx.lineTo(L / 2 + 0.18, 0);
  ctx.lineTo(L / 2, R);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a2a2c";
  ctx.beginPath();
  ctx.moveTo(L / 2 + 0.128, -R * 0.29);
  ctx.lineTo(L / 2 + 0.192, 0);
  ctx.lineTo(L / 2 + 0.128, R * 0.29);
  ctx.closePath();
  ctx.fill();
  // Ferrule and eraser.
  const metal = ctx.createLinearGradient(0, -R, 0, R);
  metal.addColorStop(0, "#9f9a8d");
  metal.addColorStop(0.7, "#e4dfd3");
  metal.addColorStop(1, "#b4ae9f");
  ctx.fillStyle = metal;
  ctx.fillRect(-L / 2 - 0.1, -R * 1.04, 0.1, 2 * R * 1.04);
  ctx.fillStyle = "#e9a8a0";
  ctx.beginPath();
  ctx.moveTo(-L / 2 - 0.1, -R * 0.98);
  ctx.lineTo(-L / 2 - 0.17, -R * 0.98);
  ctx.quadraticCurveTo(-L / 2 - 0.19, 0, -L / 2 - 0.17, R * 0.98);
  ctx.lineTo(-L / 2 - 0.1, R * 0.98);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
