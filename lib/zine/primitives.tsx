import type { ReactNode } from "react";
import {
  fitText,
  fontAttrs,
  type FitOptions,
  type FitResult,
  type FontKey,
  ellipsize,
} from "./text";
import type { Feature, Panels, Paper, Route, TrailPlan, Way, Weather } from "@/lib/schemas";
import type { Rough } from "./rough";
import type { SheetGeometry } from "./layout";

export interface ZineData {
  id: string;
  paper: Paper;
  color: boolean;
  plan?: TrailPlan;
  panels: Panels;
  route: Route;
  features: Feature[];
  ways: Way[];
  weather: Weather;
  /** ISO date-time of creation. */
  date: string;
  walkerName?: string;
  edition: number;
  model: string;
  deviceLabel: string;
  returnUrl: string;
  repoUrl: string;
  locationLabel: string;
  durationMin: number;
}

export interface Ink {
  ink: string;
  pink: string;
  teal: string;
  paper: string;
  soft: string;
  color: boolean;
}

export function inks(color: boolean): Ink {
  return color
    ? { ink: "#1B1B1B", pink: "#FF5C8A", teal: "#1F8A8A", paper: "#FFFFFF", soft: "#8a847a", color }
    : {
        ink: "#1B1B1B",
        pink: "#1B1B1B",
        teal: "#1B1B1B",
        paper: "#FFFFFF",
        soft: "#6b6b6b",
        color,
      };
}

export interface PanelProps {
  d: ZineData;
  g: SheetGeometry;
  rc: Rough;
  k: Ink;
  featureById: Map<string, Feature>;
}

export function TextBlock({
  x,
  y,
  fit,
  font,
  fill,
  anchor = "start",
  className,
}: {
  x: number;
  y: number;
  fit: FitResult;
  font: FontKey;
  fill: string;
  anchor?: "start" | "middle" | "end";
  className?: string;
}) {
  const a = fontAttrs(font);
  return (
    <text
      x={x}
      y={y}
      fontFamily={a.fontFamily}
      fontWeight={a.fontWeight}
      fontStyle={a.fontStyle}
      fontSize={fit.size}
      fill={fill}
      textAnchor={anchor}
      className={className}
    >
      {fit.lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? fit.size * 0.86 : fit.size * fit.lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export function FitText(props: {
  x: number;
  y: number;
  text: string;
  box: FitOptions;
  fill: string;
  anchor?: "start" | "middle" | "end";
  className?: string;
}) {
  const fit = fitText(props.text, props.box);
  return <TextBlock {...props} fit={fit} font={props.box.font} />;
}

export function Line({
  x,
  y,
  text,
  font,
  size,
  fill,
  maxW,
  anchor = "start",
  letterSpacing,
  children,
}: {
  x: number;
  y: number;
  text?: string;
  font: FontKey;
  size: number;
  fill: string;
  maxW?: number;
  anchor?: "start" | "middle" | "end";
  letterSpacing?: number;
  children?: ReactNode;
}) {
  const a = fontAttrs(font);
  const t = text !== undefined && maxW ? ellipsize(text, font, size, maxW) : text;
  return (
    <text
      x={x}
      y={y}
      fontFamily={a.fontFamily}
      fontWeight={a.fontWeight}
      fontStyle={a.fontStyle}
      fontSize={size}
      fill={fill}
      textAnchor={anchor}
      letterSpacing={letterSpacing}
    >
      {t}
      {children}
    </text>
  );
}

export const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥"];

export function featureLabel(f: Feature | undefined): string {
  if (!f) return "a landmark";
  if (f.name) return f.name;
  return KIND_WORDS[f.kind] ?? f.kind.replace(/_/g, " ");
}

export const KIND_WORDS: Record<string, string> = {
  bench: "a bench",
  drinking_water: "a drinking fountain",
  post_box: "a post box",
  fountain: "a fountain",
  library: "the library",
  cafe: "a café",
  bicycle_parking: "the bike racks",
  clock: "a public clock",
  waste_basket: "a bin",
  park: "the park",
  playground: "the playground",
  garden: "a garden",
  tree: "a big tree",
  water: "the water",
  wood: "the little wood",
  artwork: "an artwork",
  mural: "a mural",
  viewpoint: "a viewpoint",
  historic: "a historic spot",
  bus_stop: "the bus stop",
  street_lamp: "an old street lamp",
  man_made: "a curious structure",
  bakery: "the bakery",
  florist: "the florist",
  memorial: "a memorial",
  statue: "a statue",
};
