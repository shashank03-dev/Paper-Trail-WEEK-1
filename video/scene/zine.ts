/** The exported zine (video/build/zine.json) and the pencil marks drawn on it. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Cell extends Rect {
  rotated: boolean;
}
export interface Tick {
  index: number;
  ticked: boolean;
  box: Rect;
  d: string[];
  label: string;
  points: number;
  centre: { x: number; y: number };
}
export interface Zine {
  sheet: string;
  pages: Record<string, string>;
  geometry: {
    w: number;
    h: number;
    panelW: number;
    panelH: number;
    cells: Record<string, Cell>;
    fiducials: { corner: string; cx: number; cy: number; size: number }[];
  };
  title: string;
  ticks: Tick[];
  listen: { x: number; y: number; text: string }[];
  riddle: { x: number; y: number; text: string };
  sketch: string[];
  score: { total: number; spotted: number; of: number };
  date: string;
  /** Built here: every pencil mark, in sheet millimetres. */
  marksSvg: string;
}

export const PENCIL = "#3b3b40";
export const HAND = "Kalam";

/** Same transform as lib/zine/layout.ts panelTransform: page-local mm → sheet mm. */
export function panelTransform(c: Cell): string {
  return c.rotated
    ? `translate(${c.x + c.w} ${c.y + c.h}) rotate(180)`
    : `translate(${c.x} ${c.y})`;
}

export function tickPaths(t: Tick, width = 0.55): string {
  return t.d
    .map(
      (d) =>
        `<path d="${d}" stroke="${PENCIL}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`,
    )
    .join("");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const hand = (x: number, y: number, text: string, size: number, rot: number) =>
  `<text x="${x}" y="${y}" font-family="${HAND}" font-weight="400" font-size="${size}" fill="${PENCIL}" opacity="0.88" transform="rotate(${rot} ${x} ${y})">${esc(text)}</text>`;

export async function loadZine(url: string): Promise<Zine> {
  const z = (await (await fetch(url)).json()) as Omit<Zine, "marksSvg">;
  const g = z.geometry;
  const cell = (p: number) => g.cells[String(p)]!;
  const p4 = z.ticks.map((t) => tickPaths(t)).join("");
  const p5 = z.listen
    .map((l, i) => hand(l.x, l.y, l.text, 4.6, [-1.2, 0.8, -0.5][i] ?? 0))
    .join("");
  const p6 = hand(z.riddle.x, z.riddle.y, z.riddle.text, 5.6, -1.5);
  const p7 = z.sketch
    .map(
      (d) =>
        `<path d="${d}" stroke="${PENCIL}" stroke-width="0.45" fill="none" stroke-linecap="round" opacity="0.85"/>`,
    )
    .join("");
  const marksSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.w} ${g.h}" width="${g.w}mm" height="${g.h}mm">` +
    [
      [4, p4],
      [5, p5],
      [6, p6],
      [7, p7],
    ]
      .map(([p, c]) => `<g transform="${panelTransform(cell(p as number))}">${c}</g>`)
      .join("") +
    `</svg>`;
  return { ...z, marksSvg };
}

/** @font-face rules with the font files inlined, so SVG drawn into a canvas can use them. */
export async function inlineFonts(files: [string, number, string, string][]): Promise<string> {
  const rules = await Promise.all(
    files.map(async ([family, weight, style, file]) => {
      const buf = new Uint8Array(await (await fetch(`/public/fonts/${file}.woff2`)).arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000)
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2");}`;
    }),
  );
  return rules.join("");
}
