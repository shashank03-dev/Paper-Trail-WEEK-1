import QRCode from "qrcode";
import type { Weather } from "@/lib/schemas";
import { RoughShape, type Rough } from "./rough";
import type { Ink } from "./primitives";
import { fontAttrs } from "./text";

/** Hand-drawn weather glyph centred at (cx, cy), size s. */
export function WeatherGlyph({
  rc,
  k,
  cx,
  cy,
  s,
  condition,
}: {
  rc: Rough;
  k: Ink;
  cx: number;
  cy: number;
  s: number;
  condition: Weather["condition"];
}) {
  const sun = condition === "clear" || condition === "partly-cloudy";
  const cloudy = condition !== "clear";
  const parts = [];
  if (sun) {
    const sx = condition === "clear" ? cx : cx - s * 0.18;
    const sy = condition === "clear" ? cy : cy - s * 0.15;
    const r = s * 0.2;
    parts.push(
      <RoughShape
        key="s"
        rc={rc}
        d={rc.circle(sx, sy, r * 2, {
          stroke: k.pink,
          strokeWidth: 0.35,
          fill: k.color ? k.pink : k.paper,
          fillStyle: "solid",
        })}
      />,
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(
        <RoughShape
          key={`r${i}`}
          rc={rc}
          d={rc.line(
            sx + Math.cos(a) * r * 1.45,
            sy + Math.sin(a) * r * 1.45,
            sx + Math.cos(a) * r * 2.0,
            sy + Math.sin(a) * r * 2.0,
            { stroke: k.pink, strokeWidth: 0.3, roughness: 0.4 },
          )}
        />,
      );
    }
  }
  if (cloudy) {
    const w = s * 0.62;
    const x0 = cx - w / 2 + s * 0.08;
    const y0 = cy + s * 0.02;
    const d = `M ${x0} ${y0 + s * 0.16} q ${-s * 0.12} 0 ${-s * 0.1} ${-s * 0.12} q ${s * 0.02} ${-s * 0.12} ${s * 0.16} ${-s * 0.09} q ${s * 0.06} ${-s * 0.17} ${s * 0.26} ${-s * 0.1} q ${s * 0.2} ${-s * 0.02} ${s * 0.2} ${s * 0.14} q ${s * 0.13} ${s * 0.02} ${s * 0.1} ${s * 0.17} Z`;
    parts.push(
      <RoughShape
        key="c"
        rc={rc}
        d={rc.path(d, { stroke: k.ink, strokeWidth: 0.35, fill: k.paper, fillStyle: "solid" })}
      />,
    );
  }
  if (condition === "rain" || condition === "drizzle" || condition === "storm") {
    const n = condition === "drizzle" ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const x = cx - s * 0.12 + i * s * 0.14;
      parts.push(
        <RoughShape
          key={`d${i}`}
          rc={rc}
          d={rc.line(x, cy + s * 0.27, x - s * 0.05, cy + s * 0.42, {
            stroke: k.teal,
            strokeWidth: 0.35,
          })}
        />,
      );
    }
  }
  if (condition === "storm") {
    parts.push(
      <path
        key="b"
        d={`M ${cx + s * 0.2} ${cy + s * 0.2} l ${-s * 0.08} ${s * 0.12} h ${s * 0.07} l ${-s * 0.06} ${s * 0.13}`}
        stroke={k.pink}
        strokeWidth={0.4}
        fill="none"
      />,
    );
  }
  if (condition === "snow") {
    for (let i = 0; i < 3; i++) {
      const x = cx - s * 0.12 + i * s * 0.14;
      parts.push(
        <text
          key={`f${i}`}
          x={x}
          y={cy + s * 0.42}
          fontSize={s * 0.18}
          fill={k.teal}
          textAnchor="middle"
          fontFamily="Inter"
        >
          *
        </text>,
      );
    }
  }
  if (condition === "fog") {
    for (let i = 0; i < 3; i++) {
      parts.push(
        <RoughShape
          key={`g${i}`}
          rc={rc}
          d={rc.line(
            cx - s * 0.3,
            cy + s * (0.26 + i * 0.07),
            cx + s * 0.3,
            cy + s * (0.26 + i * 0.07),
            { stroke: k.soft, strokeWidth: 0.3 },
          )}
        />,
      );
    }
  }
  return <g aria-hidden>{parts}</g>;
}

export function Star({
  cx,
  cy,
  r,
  fill,
  stroke,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
}) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return (
    <polygon
      points={pts.join(" ")}
      fill={fill}
      stroke={stroke}
      strokeWidth={0.25}
      strokeLinejoin="round"
    />
  );
}

export function Compass({
  rc,
  k,
  cx,
  cy,
  r,
}: {
  rc: Rough;
  k: Ink;
  cx: number;
  cy: number;
  r: number;
}) {
  const a = fontAttrs("display-700");
  return (
    <g aria-hidden>
      <RoughShape
        rc={rc}
        d={rc.circle(cx, cy, r * 2, {
          stroke: k.ink,
          strokeWidth: 0.2,
          fill: k.paper,
          fillStyle: "solid",
        })}
      />
      <path
        d={`M ${cx} ${cy - r * 0.8} L ${cx + r * 0.28} ${cy} L ${cx} ${cy + r * 0.8} L ${cx - r * 0.28} ${cy} Z`}
        fill="none"
        stroke={k.ink}
        strokeWidth={0.2}
      />
      <path
        d={`M ${cx} ${cy - r * 0.8} L ${cx + r * 0.28} ${cy} L ${cx - r * 0.28} ${cy} Z`}
        fill={k.pink}
      />
      <text
        x={cx}
        y={cy - r * 1.12}
        fontSize={r * 0.7}
        textAnchor="middle"
        fill={k.ink}
        fontFamily={a.fontFamily}
        fontWeight={700}
      >
        N
      </text>
    </g>
  );
}

export function Scissors({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s / 10})`} aria-hidden>
      <circle cx={2} cy={-2.2} r={1.6} fill="none" stroke={color} strokeWidth={0.6} />
      <circle cx={2} cy={2.2} r={1.6} fill="none" stroke={color} strokeWidth={0.6} />
      <path
        d="M 3.3 -1.3 L 10 2.2 M 3.3 1.3 L 10 -2.2"
        stroke={color}
        strokeWidth={0.6}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A rubber stamp: double rough border, rotated, mono text. */
export function Stamp({
  rc,
  cx,
  cy,
  w,
  h,
  angle,
  color,
  lines,
}: {
  rc: Rough;
  cx: number;
  cy: number;
  w: number;
  h: number;
  angle: number;
  color: string;
  lines: string[];
}) {
  const a = fontAttrs("mono-500");
  const size = Math.min(h / (lines.length * 1.45), 3.3);
  return (
    <g transform={`rotate(${angle} ${cx} ${cy})`} aria-hidden>
      <RoughShape
        rc={rc}
        d={rc.rect(cx - w / 2, cy - h / 2, w, h, {
          stroke: color,
          strokeWidth: 0.6,
          roughness: 1.4,
        })}
      />
      <RoughShape
        rc={rc}
        d={rc.rect(cx - w / 2 + 1, cy - h / 2 + 1, w - 2, h - 2, {
          stroke: color,
          strokeWidth: 0.25,
          roughness: 1.2,
        })}
      />
      {lines.map((l, i) => (
        <text
          key={i}
          x={cx}
          y={cy - ((lines.length - 1) * size * 1.25) / 2 + i * size * 1.25 + size * 0.35}
          fontFamily={a.fontFamily}
          fontWeight={500}
          fontSize={size}
          fill={color}
          textAnchor="middle"
          letterSpacing={size * 0.12}
        >
          {l}
        </text>
      ))}
    </g>
  );
}

/** QR code as a single SVG path, in the given size (mm). */
export function QR({
  text,
  x,
  y,
  size,
  color,
}: {
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const m = size / (n + 2);
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c))
        d += `M${(x + (c + 1) * m).toFixed(3)} ${(y + (r + 1) * m).toFixed(3)}h${m.toFixed(3)}v${m.toFixed(3)}h${(-m).toFixed(3)}z`;
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} fill="#FFFFFF" />
      <path d={d} fill={color} shapeRendering="crispEdges" />
    </g>
  );
}

/** Tiny corner doodles for the sketch page. */
export function Doodle({
  rc,
  k,
  kind,
  x,
  y,
  s,
}: {
  rc: Rough;
  k: Ink;
  kind: number;
  x: number;
  y: number;
  s: number;
}) {
  switch (kind % 4) {
    case 0: // leaf
      return (
        <g aria-hidden>
          <RoughShape
            rc={rc}
            d={rc.path(
              `M ${x} ${y + s} Q ${x - s * 0.1} ${y + s * 0.2} ${x + s * 0.8} ${y} Q ${x + s} ${y + s * 0.8} ${x} ${y + s} Z`,
              { stroke: k.teal, strokeWidth: 0.25 },
            )}
          />
          <RoughShape
            rc={rc}
            d={rc.line(x, y + s, x + s * 0.65, y + s * 0.25, { stroke: k.teal, strokeWidth: 0.2 })}
          />
        </g>
      );
    case 1: // spiral snail-ish
      return (
        <RoughShape
          rc={rc}
          d={rc.path(
            `M ${x + s / 2} ${y + s / 2} m -${s * 0.1} 0 a ${s * 0.1} ${s * 0.1} 0 1 1 ${s * 0.2} 0 a ${s * 0.2} ${s * 0.2} 0 1 1 -${s * 0.4} 0 a ${s * 0.32} ${s * 0.32} 0 1 1 ${s * 0.64} 0`,
            { stroke: k.pink, strokeWidth: 0.25 },
          )}
        />
      );
    case 2: // little sun
      return (
        <RoughShape
          rc={rc}
          d={rc.circle(x + s / 2, y + s / 2, s * 0.6, {
            stroke: k.pink,
            strokeWidth: 0.25,
            fill: k.color ? k.pink : undefined,
            fillStyle: "dots",
            hachureGap: 0.7,
          })}
        />
      );
    default: // grass tuft
      return (
        <g aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <RoughShape
              key={i}
              rc={rc}
              d={rc.line(
                x + s * (0.2 + i * 0.2),
                y + s,
                x + s * (0.1 + i * 0.25),
                y + s * (0.2 + (i % 2) * 0.2),
                { stroke: k.teal, strokeWidth: 0.22 },
              )}
            />
          ))}
        </g>
      );
  }
}
