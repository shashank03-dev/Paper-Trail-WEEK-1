import type { Paper } from "@/lib/schemas";
import { ispyRows, PAGES, READ_PX_PER_MM, sheetGeometry, type PageNo } from "@/lib/zine/layout";
import { contrastStretch, crop, rotate180, toGray, type RGBA } from "./image";
import { detectFiducials, type Detection } from "./fiducials";
import type { Pt } from "./homography";
import { warpToSheet } from "./warp";

export interface Processed {
  sheet: RGBA;
  panels: Record<PageNo, RGBA>;
  omr: number[];
}

export function detect(img: RGBA): Detection {
  return detectFiducials(toGray(img));
}

/** Warp the photo flat, split it into upright panels and measure the checkboxes. */
export function processPhoto(
  img: RGBA,
  paper: Paper,
  corners: Pt[],
  ispyCount: number,
  pxPerMm = READ_PX_PER_MM,
): Processed {
  const g = sheetGeometry(paper);
  const sheetPts = ["tl", "tr", "br", "bl"].map((c) => {
    const f = g.fiducials.find((x) => x.corner === c)!;
    return { x: f.cx, y: f.cy };
  });
  const sheet = warpToSheet(img, sheetPts, corners, g.w, g.h, pxPerMm);
  const panels = {} as Record<PageNo, RGBA>;
  for (const p of PAGES) {
    const c = g.cells[p];
    let im = crop(sheet, c.x * pxPerMm, c.y * pxPerMm, c.w * pxPerMm, c.h * pxPerMm);
    if (c.rotated) im = rotate180(im);
    panels[p] = im;
  }
  const omr = measureTicks(panels[4], paper, ispyCount, pxPerMm);
  for (const p of [4, 5, 6, 7] as PageNo[]) panels[p] = contrastStretch(panels[p]);
  return { sheet, panels, omr };
}

/**
 * Classic OMR: fraction of inked pixels inside each checkbox (inset past the
 * printed outline), relative to this panel's paper brightness.
 */
export function measureTicks(
  panel: RGBA,
  paper: Paper,
  n: number,
  pxPerMm = READ_PX_PER_MM,
): number[] {
  const g = sheetGeometry(paper);
  const gray = toGray(panel);
  const sorted = Uint8Array.from(gray.data).sort();
  const paperLevel = sorted[Math.floor(sorted.length * 0.9)] ?? 255;
  const thr = paperLevel * 0.66;
  const rows = ispyRows(g, Math.max(n, 8)).slice(0, n);
  return rows.map((r) => {
    const inset = 1.15;
    const x0 = Math.round((r.box.x + inset) * pxPerMm);
    const y0 = Math.round((r.box.y + inset) * pxPerMm);
    const x1 = Math.round((r.box.x + r.box.w - inset) * pxPerMm);
    const y1 = Math.round((r.box.y + r.box.h - inset) * pxPerMm);
    let ink = 0;
    let tot = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (x < 0 || y < 0 || x >= gray.width || y >= gray.height) continue;
        tot++;
        if (gray.data[y * gray.width + x]! < thr) ink++;
      }
    return tot ? Math.round((ink / tot) * 1000) / 1000 : 0;
  });
}
