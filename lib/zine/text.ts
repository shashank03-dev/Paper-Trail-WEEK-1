/**
 * Deterministic text measurement and fitting, from real font advance widths.
 * Same results in the browser, on the server and in scripts.
 */
import { FONT_METRICS } from "./metrics.generated";

export type FontKey =
  | "display-400"
  | "display-600"
  | "display-700"
  | "display-400i"
  | "ui-400"
  | "ui-500"
  | "ui-600"
  | "mono-400"
  | "mono-500"
  | "hand-400"
  | "hand-700";

export const FONT_FAMILY: Record<string, string> = {
  display: "Fraunces, Georgia, serif",
  ui: "Inter, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
  hand: "Caveat, cursive",
};

export function fontAttrs(font: FontKey): {
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
} {
  const [fam, w] = font.split("-") as [string, string];
  return {
    fontFamily: FONT_FAMILY[fam]!,
    fontWeight: parseInt(w, 10),
    fontStyle: w.endsWith("i") ? "italic" : "normal",
  };
}

/** Width of `text` set in `font` at `size` (same unit as size, e.g. mm). */
export function measure(text: string, font: FontKey, size: number): number {
  const m = FONT_METRICS[font];
  if (!m) throw new Error(`no metrics for ${font}`);
  let w = 0;
  for (const ch of text) w += m.widths[ch] ?? m.fallback;
  return (w / 1000) * size;
}

/** Greedy word wrap. Words longer than a line are broken by characters. */
export function wrap(text: string, font: FontKey, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, font, size) <= maxW) {
        line = candidate;
        continue;
      }
      if (line) out.push(line);
      if (measure(word, font, size) <= maxW) {
        line = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          if (measure(chunk + ch, font, size) > maxW && chunk) {
            out.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      }
    }
    out.push(line);
  }
  // Drop trailing empty line from a trailing newline, keep intentional blank lines inside.
  while (out.length > 1 && out[out.length - 1] === "") out.pop();
  return out;
}

export interface FitOptions {
  font: FontKey;
  maxSize: number;
  minSize: number;
  maxW: number;
  maxH: number;
  lineHeight?: number;
  maxLines?: number;
}

export interface FitResult {
  lines: string[];
  size: number;
  lineHeight: number;
  /** True if the text only fit after truncation. */
  truncated: boolean;
  /** Height actually used. */
  height: number;
}

/**
 * Shrink the font from maxSize toward minSize until the text fits the box;
 * if it still overflows at minSize, truncate with an ellipsis.
 */
export function fitText(text: string, o: FitOptions): FitResult {
  const lh = o.lineHeight ?? 1.22;
  const clean = text.replace(/[ \t]+/g, " ").trim();
  const step = Math.max(0.05, (o.maxSize - o.minSize) / 24);
  for (let size = o.maxSize; size >= o.minSize - 1e-9; size -= step) {
    const lines = wrap(clean, o.font, size, o.maxW);
    const tooMany = o.maxLines !== undefined && lines.length > o.maxLines;
    if (!tooMany && lines.length * size * lh <= o.maxH + 1e-6) {
      return { lines, size, lineHeight: lh, truncated: false, height: lines.length * size * lh };
    }
  }
  const size = o.minSize;
  const all = wrap(clean, o.font, size, o.maxW);
  const fitLines = Math.max(
    1,
    Math.min(o.maxLines ?? Infinity, Math.floor(o.maxH / (size * lh) + 1e-6)),
  );
  const lines = all.slice(0, fitLines);
  let last = lines[lines.length - 1] ?? "";
  while (last.length > 0 && measure(`${last}…`, o.font, size) > o.maxW) last = last.slice(0, -1);
  lines[lines.length - 1] = `${last.replace(/[\s,.;:]+$/, "")}…`;
  return { lines, size, lineHeight: lh, truncated: true, height: lines.length * size * lh };
}

/** Does the text fit without truncation? Used server-side to ask Gemma for a shorter version. */
export function fits(text: string, o: FitOptions): boolean {
  return !fitText(text, o).truncated;
}

/** Truncate a single line to a width. */
export function ellipsize(text: string, font: FontKey, size: number, maxW: number): string {
  if (measure(text, font, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && measure(`${t}…`, font, size) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}
