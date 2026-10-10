/**
 * Text boxes for every model-written field. The renderer draws into these and
 * the server checks generated copy against them (on both paper sizes) before
 * accepting it, so text never overflows a panel.
 */
import type { Paper } from "@/lib/schemas";
import { contentBox, ispyRows, riddleAnswerBox, sheetGeometry, type SheetGeometry } from "./layout";
import { fitText, type FitOptions } from "./text";

export type TextField =
  | "coverKicker"
  | "coverTitle"
  | "coverSubtitle"
  | "coverBlurb"
  | "routeStop"
  | "ifLost"
  | "listenIntro"
  | "riddleText"
  | "sketchPrompt"
  | "backBlurb"
  | "ispyLabel"
  | "ispyHint";

export const HEADER_H = 8;

export function textBox(
  g: SheetGeometry,
  field: TextField,
  opts: { stops?: number; ispyCount?: number } = {},
): FitOptions {
  const cb = contentBox(g);
  switch (field) {
    case "coverKicker":
      return { font: "ui-600", maxSize: 2.5, minSize: 2.0, maxW: cb.w, maxH: 3.2, maxLines: 1 };
    case "coverTitle":
      return {
        font: "display-700",
        maxSize: 8.6,
        minSize: 4.6,
        maxW: cb.w,
        maxH: 26,
        lineHeight: 1.04,
        maxLines: 4,
      };
    case "coverSubtitle":
      return {
        font: "display-400i",
        maxSize: 3.3,
        minSize: 2.5,
        maxW: cb.w,
        maxH: 7.6,
        lineHeight: 1.15,
        maxLines: 2,
      };
    case "coverBlurb":
      return {
        font: "ui-400",
        maxSize: 2.5,
        minSize: 2.0,
        maxW: cb.w,
        maxH: 9.6,
        lineHeight: 1.3,
        maxLines: 3,
      };
    case "routeStop": {
      const n = Math.max(1, opts.stops ?? 6);
      const per = (cb.h - HEADER_H - 13) / n;
      return {
        font: "ui-400",
        maxSize: 2.45,
        minSize: 1.85,
        maxW: cb.w - 6.2,
        maxH: per - 1.2,
        lineHeight: 1.25,
        maxLines: 4,
      };
    }
    case "ifLost":
      return {
        font: "ui-500",
        maxSize: 2.3,
        minSize: 1.9,
        maxW: cb.w - 4,
        maxH: 7,
        lineHeight: 1.25,
        maxLines: 3,
      };
    case "listenIntro":
      return {
        font: "display-400i",
        maxSize: 2.9,
        minSize: 2.2,
        maxW: cb.w,
        maxH: 16,
        lineHeight: 1.22,
        maxLines: 5,
      };
    case "riddleText": {
      const box = riddleAnswerBox(g);
      return {
        font: "display-400i",
        maxSize: 3.5,
        minSize: 2.4,
        maxW: cb.w,
        maxH: box.y - 3 - (cb.y + HEADER_H + 3),
        lineHeight: 1.3,
        maxLines: 9,
      };
    }
    case "sketchPrompt":
      return {
        font: "display-400i",
        maxSize: 3.1,
        minSize: 2.3,
        maxW: cb.w,
        maxH: 10,
        lineHeight: 1.2,
        maxLines: 3,
      };
    case "backBlurb":
      return {
        font: "ui-400",
        maxSize: 2.5,
        minSize: 2.0,
        maxW: cb.w,
        maxH: 11,
        lineHeight: 1.3,
        maxLines: 4,
      };
    case "ispyLabel": {
      const row = ispyRows(g, opts.ispyCount ?? 10)[0]!;
      return {
        font: "ui-600",
        maxSize: 2.45,
        minSize: 2.0,
        maxW: row.textW,
        maxH: 3.2,
        maxLines: 1,
      };
    }
    case "ispyHint": {
      const row = ispyRows(g, opts.ispyCount ?? 10)[0]!;
      return {
        font: "ui-400",
        maxSize: 1.95,
        minSize: 1.7,
        maxW: row.textW,
        maxH: 2.6,
        maxLines: 1,
      };
    }
  }
}

const GEOS: SheetGeometry[] = (["letter", "a4"] as Paper[]).map(sheetGeometry);

/** True if the text fits its box on every paper size. */
export function fitsEverywhere(
  field: TextField,
  text: string,
  opts: { stops?: number; ispyCount?: number } = {},
): boolean {
  return GEOS.every((g) => !fitText(text, textBox(g, field, opts)).truncated);
}
