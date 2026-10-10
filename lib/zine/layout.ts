/**
 * The single source of truth for sheet geometry, in millimetres.
 * The renderer, print CSS, PDF export, OMR and panel crops all read from here.
 */
import type { Paper } from "@/lib/schemas";

export const PAPER_MM: Record<Paper, { w: number; h: number; label: string }> = {
  letter: { w: 279.4, h: 215.9, label: "US Letter" },
  a4: { w: 297, h: 210, label: "A4" },
};

/**
 * Panels are exact quarters of the sheet, so the physical folds (halving the
 * paper) land exactly on panel edges. Margins live inside each panel.
 */
/** Distance of the corner markers from the sheet edges (inside printers' margins). */
export const MARGIN = 5;
/** Frame inset from every panel edge: ≥ 5 mm from the paper edge and from each fold. */
export const GUTTER = 5.5;
/** Content padding inside the frame. */
export const PAD = 3.5;
/** Bottom band of every panel; its corners hold the fiducials on pages 1, 2, 5, 6. */
export const FOOTER = 14;
/** Fiducial marker: solid black square with a white inner square. */
export const FIDUCIAL = 8;
export const FIDUCIAL_INNER = 4;

export const COLS = 4;
export const ROWS = 2;

export type PageNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const PAGES: PageNo[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Standard one-cut mini-zine imposition.
 * Top row, left→right: 5 4 3 2 (rotated 180°). Bottom row: 6 7 8 1 (upright).
 * If a physical fold test comes out wrong, this table is the only fix needed.
 */
export const IMPOSITION: Record<PageNo, { col: number; row: number; rotated: boolean }> = {
  5: { col: 0, row: 0, rotated: true },
  4: { col: 1, row: 0, rotated: true },
  3: { col: 2, row: 0, rotated: true },
  2: { col: 3, row: 0, rotated: true },
  6: { col: 0, row: 1, rotated: false },
  7: { col: 1, row: 1, rotated: false },
  8: { col: 2, row: 1, rotated: false },
  1: { col: 3, row: 1, rotated: false },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetGeometry {
  paper: Paper;
  w: number;
  h: number;
  grid: Rect;
  panelW: number;
  panelH: number;
  cells: Record<PageNo, Rect & { rotated: boolean }>;
  fiducials: {
    corner: "tl" | "tr" | "br" | "bl";
    x: number;
    y: number;
    size: number;
    cx: number;
    cy: number;
  }[];
  /** The one cut: horizontal centre line across the middle two columns. */
  cut: { x1: number; y1: number; x2: number; y2: number };
}

export function sheetGeometry(paper: Paper): SheetGeometry {
  const { w, h } = PAPER_MM[paper];
  const grid = { x: 0, y: 0, w, h };
  const panelW = grid.w / COLS;
  const panelH = grid.h / ROWS;
  const cells = {} as SheetGeometry["cells"];
  for (const p of PAGES) {
    const { col, row, rotated } = IMPOSITION[p];
    cells[p] = {
      x: grid.x + col * panelW,
      y: grid.y + row * panelH,
      w: panelW,
      h: panelH,
      rotated,
    };
  }
  const f = FIDUCIAL;
  const fiducials: SheetGeometry["fiducials"] = [
    { corner: "tl", x: MARGIN, y: MARGIN },
    { corner: "tr", x: w - MARGIN - f, y: MARGIN },
    { corner: "br", x: w - MARGIN - f, y: h - MARGIN - f },
    { corner: "bl", x: MARGIN, y: h - MARGIN - f },
  ].map((d) => ({
    ...(d as { corner: "tl" | "tr" | "br" | "bl"; x: number; y: number }),
    size: f,
    cx: d.x + f / 2,
    cy: d.y + f / 2,
  }));
  const cy = grid.y + panelH;
  return {
    paper,
    w,
    h,
    grid,
    panelW,
    panelH,
    cells,
    fiducials,
    cut: { x1: grid.x + panelW, y1: cy, x2: grid.x + 3 * panelW, y2: cy },
  };
}

/** SVG transform that places a panel-local drawing (origin top-left, upright) into its cell. */
export function panelTransform(g: SheetGeometry, page: PageNo): string {
  const c = g.cells[page];
  return c.rotated
    ? `translate(${r(c.x + c.w)} ${r(c.y + c.h)}) rotate(180)`
    : `translate(${r(c.x)} ${r(c.y)})`;
}

/** Map a panel-local point to sheet coordinates. */
export function panelToSheet(
  g: SheetGeometry,
  page: PageNo,
  x: number,
  y: number,
): { x: number; y: number } {
  const c = g.cells[page];
  return c.rotated ? { x: c.x + c.w - x, y: c.y + c.h - y } : { x: c.x + x, y: c.y + y };
}

/** Content box inside a panel, panel-local. */
export function contentBox(g: SheetGeometry): Rect {
  const inset = GUTTER + PAD;
  return { x: inset, y: inset, w: g.panelW - 2 * inset, h: g.panelH - inset - FOOTER };
}

/** Frame (decorative border) rect, panel-local. */
export function frameBox(g: SheetGeometry): Rect {
  return { x: GUTTER, y: GUTTER, w: g.panelW - 2 * GUTTER, h: g.panelH - 2 * GUTTER };
}

export const ISPY_HEADER = 13;

export interface IspyRow {
  index: number;
  y: number;
  pitch: number;
  box: Rect;
  textX: number;
  textW: number;
  pointsX: number;
}

/** Exact I-Spy rows on page 4 (panel-local). OMR measures ink inside `box`. */
export function ispyRows(g: SheetGeometry, n: number): IspyRow[] {
  const cb = contentBox(g);
  const top = cb.y + ISPY_HEADER;
  const avail = cb.h - ISPY_HEADER;
  const pitch = Math.min(9.5, avail / Math.max(1, n));
  const s = Math.min(7, pitch - 1.0);
  const pointsW = 7;
  return Array.from({ length: n }, (_, i) => {
    const y = top + i * pitch;
    const box = { x: cb.x, y: y + (pitch - s) / 2, w: s, h: s };
    const textX = cb.x + s + 2.2;
    return {
      index: i,
      y,
      pitch,
      box,
      textX,
      textW: cb.x + cb.w - pointsW - textX - 1,
      pointsX: cb.x + cb.w,
    };
  });
}

/** Writing areas on page 5 / 6 (panel-local), shared by renderer and synthetic filler. */
export function listenLines(
  g: SheetGeometry,
): { label: string; key: "loudest" | "quietest" | "newSound"; y: number; lines: number[] }[] {
  const cb = contentBox(g);
  const top = cb.y + 27;
  const block = 13.5;
  const labels = [
    ["The loudest sound:", "loudest"],
    ["The quietest sound:", "quietest"],
    ["A sound you've never noticed:", "newSound"],
  ] as const;
  return labels.map(([label, key], i) => {
    const y = top + i * block;
    return { label, key, y, lines: [y + 7.5, y + 12.5] };
  });
}

export function sensesBox(g: SheetGeometry): Rect {
  const cb = contentBox(g);
  return { x: cb.x, y: cb.y + cb.h - 15, w: cb.w, h: 15 };
}

export function riddleAnswerBox(g: SheetGeometry): Rect {
  const cb = contentBox(g);
  return { x: cb.x, y: cb.y + cb.h - 24, w: cb.w, h: 20 };
}

export function sketchFrame(g: SheetGeometry): Rect {
  const cb = contentBox(g);
  return { x: cb.x + 1, y: cb.y + 20, w: cb.w - 2, h: cb.h - 22 };
}

/** Raster resolution used by the reader after the warp. */
export const READ_PX_PER_MM = 6;

function r(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}
