import type { RGBA } from "./image";
import { createRGBA } from "./image";
import { applyH, solveHomography, type Pt } from "./homography";

/**
 * Inverse-mapped perspective warp with bilinear sampling.
 * `corners` are the image positions of the known sheet points `sheetPts` (mm);
 * output is the sheet at `pxPerMm`.
 */
export function warpToSheet(
  img: RGBA,
  sheetPts: Pt[],
  corners: Pt[],
  sheetW: number,
  sheetH: number,
  pxPerMm: number,
): RGBA {
  const H = solveHomography(sheetPts, corners); // sheet mm → image px
  const W = Math.round(sheetW * pxPerMm);
  const Ht = Math.round(sheetH * pxPerMm);
  const out = createRGBA(W, Ht);
  const { width: iw, height: ih, data } = img;
  for (let y = 0; y < Ht; y++) {
    for (let x = 0; x < W; x++) {
      const p = applyH(H, { x: (x + 0.5) / pxPerMm, y: (y + 0.5) / pxPerMm });
      const sx = p.x - 0.5;
      const sy = p.y - 0.5;
      const o = (y * W + x) * 4;
      if (sx < 0 || sy < 0 || sx >= iw - 1 || sy >= ih - 1) {
        out.data[o] = out.data[o + 1] = out.data[o + 2] = 255;
        out.data[o + 3] = 255;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * iw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + iw * 4;
      const i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = data[i00 + c]! * (1 - fx) + data[i10 + c]! * fx;
        const bot = data[i01 + c]! * (1 - fx) + data[i11 + c]! * fx;
        out.data[o + c] = top * (1 - fy) + bot * fy;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}
