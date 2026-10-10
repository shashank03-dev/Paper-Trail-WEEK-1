/**
 * The front of the sheet as a canvas: plain paper, the dotted route being
 * planned, the real zine printing panel by panel, and the walker's pencil.
 * Ink is multiplied onto the paper grain, the way a riso print sits in paper.
 */
import { drawPaper } from "@/components/landing/paperTexture";
import type { Zine } from "./zine";

export const PXMM = 10;
const RISO = "#2B3DD8";

export interface SheetLook {
  /** Print progress for pages 1–8 (index 0 = page 1), 0 → 1. */
  print: number[];
  /** How much of the planned route is drawn, 0 → 1. */
  route: number;
  routeAlpha: number;
  /** Pencil marks (ticks, words, sketch), 0 → 1. */
  marks: number;
}

/** A hand-picked loop across the blank sheet, mm. Starts and ends at the pin. */
export const ROUTE_MM: [number, number][] = [
  [62, 152],
  [70, 98],
  [112, 58],
  [168, 46],
  [222, 72],
  [236, 128],
  [204, 168],
  [146, 176],
  [98, 172],
];
export const ROUTE_STOPS = [2, 4, 5, 7];

export class SheetTexture {
  readonly canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement("canvas");
  private routeLayer = document.createElement("canvas");
  private printed!: HTMLCanvasElement;
  private marks!: HTMLCanvasElement;
  private route: { pts: [number, number][]; len: number[] };
  private key = "";

  constructor(private zine: Zine) {
    const w = Math.round(zine.geometry.w * PXMM);
    const h = Math.round(zine.geometry.h * PXMM);
    for (const c of [this.canvas, this.base, this.routeLayer]) {
      c.width = w;
      c.height = h;
    }
    this.ctx = this.canvas.getContext("2d")!;
    drawPaper(this.base.getContext("2d")!, w, h, "#FBFAF6");
    this.route = sampleLoop(ROUTE_MM, 400);
  }

  async load(fontCss: string): Promise<void> {
    const g = this.zine.geometry;
    this.printed = await rasterise(this.zine.sheet, g.w, g.h, fontCss);
    this.marks = await rasterise(this.zine.marksSvg, g.w, g.h, fontCss, true);
  }

  /** Redraw if anything visible changed; returns true when it did. */
  draw(s: SheetLook): boolean {
    const key = [
      ...s.print.map((p) => p.toFixed(3)),
      s.route.toFixed(3),
      s.routeAlpha.toFixed(2),
      s.marks.toFixed(2),
    ].join();
    if (key === this.key) return false;
    this.key = key;
    const c = this.ctx;
    const g = this.zine.geometry;
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.drawImage(this.base, 0, 0);

    const cells = s.print.map((p, i) => ({ p, cell: g.cells[String(i + 1)]! }));
    if (s.routeAlpha > 0 && s.route > 0) {
      const r = this.routeLayer.getContext("2d")!;
      r.clearRect(0, 0, this.routeLayer.width, this.routeLayer.height);
      this.drawRoute(r, s.route);
      // Printing covers the plan: wherever a panel has printed, the dotted line is gone.
      for (const { p, cell } of cells) {
        if (p <= 0) continue;
        const [y0, y1] = revealed(cell, p);
        r.clearRect(cell.x * PXMM, y0 * PXMM, cell.w * PXMM, (y1 - y0) * PXMM);
      }
      c.globalAlpha = s.routeAlpha;
      c.drawImage(this.routeLayer, 0, 0);
      c.globalAlpha = 1;
    }

    c.globalCompositeOperation = "multiply";
    for (const { p, cell } of cells) {
      if (p <= 0) continue;
      const [y0, y1] = revealed(cell, p);
      const sx = cell.x * PXMM;
      const sy = y0 * PXMM;
      const sw = cell.w * PXMM;
      const sh = Math.max(1, (y1 - y0) * PXMM);
      c.drawImage(this.printed, sx, sy, sw, sh, sx, sy, sw, sh);
    }
    c.globalCompositeOperation = "source-over";
    // The print head: a thin riso line riding the edge of each panel as it prints.
    for (const { p, cell } of cells) {
      if (p <= 0 || p >= 1) continue;
      const edge = cell.rotated ? cell.y + cell.h * (1 - p) : cell.y + cell.h * p;
      c.fillStyle = RISO;
      c.globalAlpha = 0.85 * Math.sin(Math.PI * p) ** 0.5;
      c.fillRect(cell.x * PXMM + 6, edge * PXMM - 3, cell.w * PXMM - 12, 6);
      c.globalAlpha = 1;
    }
    if (s.marks > 0) {
      c.globalCompositeOperation = "multiply";
      c.globalAlpha = s.marks;
      c.drawImage(this.marks, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }
    return true;
  }

  private drawRoute(r: CanvasRenderingContext2D, k: number) {
    const { pts, len } = this.route;
    const total = len[len.length - 1]!;
    const upto = total * k;
    const gap = 4.4;
    r.fillStyle = RISO;
    for (let d = 0; d <= upto; d += gap) {
      const [x, y] = at(pts, len, d);
      r.beginPath();
      r.arc(x * PXMM, y * PXMM, 1.15 * PXMM, 0, Math.PI * 2);
      r.fill();
    }
    // Stops pop on as the line reaches them.
    for (const i of ROUTE_STOPS) {
      const d = len[Math.round((i / ROUTE_MM.length) * (len.length - 1))]!;
      if (d > upto) continue;
      const pop = Math.min(1, (upto - d) / 10);
      const [x, y] = ROUTE_MM[i]!;
      r.beginPath();
      r.arc(x * PXMM, y * PXMM, 3.2 * PXMM * (0.6 + 0.4 * pop), 0, Math.PI * 2);
      r.fillStyle = "#FBFAF6";
      r.fill();
      r.lineWidth = 0.75 * PXMM;
      r.strokeStyle = RISO;
      r.stroke();
      r.fillStyle = RISO;
    }
  }

  /** The route's point at fraction k, mm (for the pin and anything riding the line). */
  routeAt(k: number): [number, number] {
    const { pts, len } = this.route;
    return at(pts, len, len[len.length - 1]! * k);
  }
}

/** The rows of a cell (mm, sheet y) that have printed so far; rotated panels print from their own top. */
function revealed(cell: { y: number; h: number; rotated: boolean }, p: number): [number, number] {
  return cell.rotated
    ? [cell.y + cell.h * (1 - p), cell.y + cell.h]
    : [cell.y, cell.y + cell.h * p];
}

function sampleLoop(ctrl: [number, number][], n: number) {
  const pts: [number, number][] = [];
  const m = ctrl.length;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * m;
    const seg = Math.min(m - 1, Math.floor(u));
    const t = u - seg;
    const p0 = ctrl[(seg - 1 + m) % m]!;
    const p1 = ctrl[seg]!;
    const p2 = ctrl[(seg + 1) % m]!;
    const p3 = ctrl[(seg + 2) % m]!;
    const cr = (a: number, b: number, c: number, d: number) =>
      0.5 *
      (2 * b +
        (-a + c) * t +
        (2 * a - 5 * b + 4 * c - d) * t * t +
        (-a + 3 * b - 3 * c + d) * t * t * t);
    pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
  }
  const len = [0];
  for (let i = 1; i < pts.length; i++)
    len.push(len[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return { pts, len };
}

function at(pts: [number, number][], len: number[], d: number): [number, number] {
  let i = 1;
  while (i < len.length - 1 && len[i]! < d) i++;
  const a = pts[i - 1]!;
  const b = pts[i]!;
  const k = (d - len[i - 1]!) / Math.max(1e-6, len[i]! - len[i - 1]!);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** Draw an SVG (mm viewBox) into a canvas at PXMM, with fonts inlined so its text renders. */
async function rasterise(
  svg: string,
  wmm: number,
  hmm: number,
  fontCss: string,
  transparent = false,
): Promise<HTMLCanvasElement> {
  const w = Math.round(wmm * PXMM);
  const h = Math.round(hmm * PXMM);
  const styled = svg
    .replace(/<svg([^>]*)>/, `<svg$1><style>${fontCss}.sheet-bg{fill:#fff}</style>`)
    .replace(/width="[^"]*mm"/, `width="${w}"`)
    .replace(/height="[^"]*mm"/, `height="${h}"`);
  const url = URL.createObjectURL(new Blob([styled], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    if (!transparent) {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, w, h);
    }
    g.drawImage(img, 0, 0, w, h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
