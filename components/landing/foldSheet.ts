/**
 * The landing sheet as one continuous piece of paper, folded by bending it.
 *
 * The rigid way to fold a mesh is to hinge panels at their edges, which reads
 * as cardboard. Paper instead rolls around each crease: a strip of width r·θ
 * bends around a cylinder of radius r while the rest of the flap follows it
 * rigidly. Folds are applied innermost first (the long crease, then the
 * concertina from the outer edge in), each to the already-folded result, the
 * same order the hierarchy of real flaps has. Radii grow outward so stacked
 * layers wrap around each other instead of intersecting, and every crease
 * widens while it is moving, so a flap rolls over rather than snapping.
 *
 * Units are 100 mm: a US Letter sheet, landscape, is 2.794 × 2.159.
 */

export const SHEET_W = 2.794;
/** Where the desk (the shadow catcher) sits, behind the paper. */
export const DESK_Z = -0.42;
/** The camera: distance and vertical field of view. */
export const CAMERA_Z = 7;
export const CAMERA_FOV = 30;
export const SHEET_H = 2.159;
const CW = SHEET_W / 4;
const CH = SHEET_H / 2;

/** Fold progress, 0 = flat, 1 = folded flat against its neighbour. */
export interface FoldState {
  /** The long crease: the top row (pages 5 4 3 2) folds behind the bottom row. */
  top: number;
  /** Concertina creases, right to left: page 8 behind page 1, 7 over 8, 6 behind 7. */
  a: number;
  b: number;
  c: number;
  /** 0..1: how much the flaps are moving right now (bows the paper, softens creases). */
  flex: number;
}

interface Crease {
  key: keyof Omit<FoldState, "flex">;
  axis: 0 | 1; // 0 = x, 1 = y
  at: number; // crease position along the axis
  side: 1 | -1; // which way the moving flap lies (+1 = increasing coordinate)
  dir: 1 | -1; // which way it folds (+1 = toward the viewer)
  r: number; // resting crease radius
  span: number; // width of the flap next to the crease (for the bow)
}

/*
 * Innermost first. Radii: each fold must wrap the layers already folded inside
 * it (top row 2·r, then the concertina stacks), so outer creases are rounder.
 */
const CREASES: Crease[] = [
  { key: "top", axis: 1, at: 0, side: 1, dir: -1, r: 0.006, span: CH },
  { key: "c", axis: 0, at: -CW, side: -1, dir: -1, r: 0.016, span: CW },
  { key: "b", axis: 0, at: 0, side: -1, dir: 1, r: 0.009, span: CW },
  { key: "a", axis: 0, at: CW, side: -1, dir: -1, r: 0.018, span: CW },
];

const PI = Math.PI;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Deform a flat grid into the folded paper.
 * `flat` holds x,y per vertex (z = 0); `out` receives x,y,z.
 */
export function foldVertices(flat: Float32Array, out: Float32Array, s: FoldState): void {
  const n = flat.length / 2;
  // A gentle curl while the sheet is open, as paper off a printer has; gone once folded.
  const open = 1 - Math.max(s.top, s.a, s.b, s.c);
  const curl = 0.035 * open * open;
  const bow = 0.06 * s.flex;
  const theta = CREASES.map((c) => PI * Math.min(1, Math.max(0, s[c.key])));
  const radius = CREASES.map(
    (c, i) => c.r + (c.key === "top" ? 0.07 : 0.04) * Math.sin(theta[i]!) * (0.4 + 0.6 * s.flex),
  );
  for (let v = 0; v < n; v++) {
    const fx = flat[v * 2]!;
    const fy = flat[v * 2 + 1]!;
    const p = [fx, fy];
    // Out-of-plane offset before folding: curl plus a bow on flaps that are mid-swing.
    let z = curl * ((fx / (SHEET_W / 2)) ** 2 * 0.6 + (fy / (SHEET_H / 2)) ** 2 * 0.4) - curl * 0.5;
    for (let i = 0; i < CREASES.length; i++) {
      const c = CREASES[i]!;
      const d0 = ((c.axis === 0 ? fx : fy) - c.at) * c.side;
      if (d0 <= 0 || theta[i] === 0) continue;
      const k = Math.min(1, d0 / c.span);
      // The flap trails its crease slightly, like paper pushing through air.
      z -= c.dir * bow * Math.sin(theta[i]!) * Math.sin(PI * ease(k)) * 0.5;
    }
    for (let i = 0; i < CREASES.length; i++) {
      const c = CREASES[i]!;
      const th = theta[i]!;
      if (th === 0) continue;
      const d0 = ((c.axis === 0 ? fx : fy) - c.at) * c.side;
      if (d0 <= 0) continue;
      const r = radius[i]!;
      const L = r * th;
      const a = (p[c.axis]! - c.at) * c.side; // current distance along the flap
      let A: number;
      let Z: number;
      if (d0 <= L) {
        // On the bend: wrap around the cylinder, keeping this layer's offset along the normal.
        const phi = a / r;
        A = r * Math.sin(phi) - c.dir * Math.sin(phi) * z;
        Z = c.dir * r * (1 - Math.cos(phi)) + Math.cos(phi) * z;
      } else {
        // Past the bend: the rest of the flap follows rigidly from the end of the arc.
        const rel = a - L;
        const sin = Math.sin(th);
        const cos = Math.cos(th);
        A = r * sin + cos * rel - c.dir * sin * z;
        Z = c.dir * r * (1 - cos) + c.dir * sin * rel + cos * z;
      }
      p[c.axis] = c.at + c.side * A;
      z = Z;
    }
    out[v * 3] = p[0]!;
    out[v * 3 + 1] = p[1]!;
    out[v * 3 + 2] = z;
  }
}

/** Centre of the folded paper's footprint, so the visible part stays where the pose puts it. */
export function footprintCentre(pos: Float32Array): [number, number] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]!;
    const y = pos[i + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}
