import type { Feature, Route, Way } from "@/lib/schemas";
import { RoughShape, type Rough } from "./rough";
import { Compass, Star } from "./glyphs";
import type { Ink } from "./primitives";
import type { Rect } from "./layout";
import { fontAttrs } from "./text";
import { project } from "@/lib/geo";

/** A hand-drawn map of the real streets, drawn entirely in code from OSM geometry. */
export function HandMap({
  rc,
  k,
  box,
  route,
  ways,
  features,
  clipId,
}: {
  rc: Rough;
  k: Ink;
  box: Rect;
  route: Route;
  ways: Way[];
  features: Feature[];
  clipId: string;
}) {
  const { lat: lat0, lon: lon0 } = route.start;
  const pts = route.waypoints.map((w) => project(lat0, lon0, w.lat, w.lon));
  const extent = Math.max(230, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.3;
  const scale = Math.min(box.w, box.h) / 2 / extent;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const toXY = (lat: number, lon: number): [number, number] => {
    const p = project(lat0, lon0, lat, lon);
    return [cx + p.x * scale, cy - p.y * scale];
  };
  const inView = ([x, y]: [number, number]) =>
    x > box.x - box.w && x < box.x + 2 * box.w && y > box.y - box.h && y < box.y + 2 * box.h;

  const areas = ways.filter((w) => w.kind === "park" || w.kind === "water");
  const lines = ways.filter((w) => w.kind !== "park" && w.kind !== "water");
  const order = { path: 0, minor: 1, major: 2 } as Record<string, number>;
  lines.sort((a, b) => (order[a.kind] ?? 0) - (order[b.kind] ?? 0));

  const loop: [number, number][] = [
    toXY(lat0, lon0),
    ...route.waypoints.map((w) => toXY(w.lat, w.lon)),
    toXY(lat0, lon0),
  ];
  const mono = fontAttrs("mono-500");
  const metersPerMm = 1 / scale;
  const barM = niceBar(metersPerMm * box.w * 0.3);

  // Label up to 3 named major streets at their midpoints.
  const labels = lines
    .filter((w) => w.kind === "major" && w.name)
    .filter((w, i, arr) => arr.findIndex((x) => x.name === w.name) === i)
    .slice(0, 4)
    .map((w) => {
      // Label at the vertex nearest the map centre, so it lands inside the box.
      const xys = w.coords.map(([la, lo]) => toXY(la, lo));
      const best = xys.reduce((a, b) =>
        Math.hypot(b[0] - cx, b[1] - cy) < Math.hypot(a[0] - cx, a[1] - cy) ? b : a,
      );
      return {
        name: w.name!,
        xy: [(best[0] + cx) / 2 + (best[0] - cx) * 0.6, best[1]] as [number, number],
      };
    })
    .filter(
      (l) =>
        l.xy[0] > box.x + 4 &&
        l.xy[0] < box.x + box.w - 4 &&
        l.xy[1] > box.y + 4 &&
        l.xy[1] < box.y + box.h - 4,
    );

  const featureById = new Map(features.map((f) => [f.id, f]));

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {areas.map((w) => {
          const poly = w.coords.map(([la, lo]) => toXY(la, lo));
          if (!poly.some(inView) || poly.length < 3) return null;
          return w.kind === "park" ? (
            <RoughShape
              key={w.id}
              rc={rc}
              d={rc.polygon(poly, {
                stroke: k.teal,
                strokeWidth: 0.15,
                fill: k.teal,
                fillStyle: k.color ? "hachure" : "cross-hatch",
                hachureAngle: -41,
                hachureGap: k.color ? 1.0 : 1.4,
                fillWeight: 0.12,
                roughness: 0.7,
              })}
            />
          ) : (
            <RoughShape
              key={w.id}
              rc={rc}
              d={rc.polygon(poly, {
                stroke: k.teal,
                strokeWidth: 0.2,
                fill: k.teal,
                fillStyle: "zigzag-line",
                zigzagOffset: 0.6,
                hachureGap: 1.3,
                fillWeight: 0.14,
                roughness: 0.6,
              })}
            />
          );
        })}
        {lines.map((w) => {
          const poly = w.coords.map(([la, lo]) => toXY(la, lo));
          if (!poly.some(inView) || poly.length < 2) return null;
          const style =
            w.kind === "major"
              ? { stroke: k.ink, strokeWidth: 0.55, roughness: 0.7 }
              : w.kind === "minor"
                ? { stroke: k.ink, strokeWidth: 0.32, roughness: 0.8, disableMultiStroke: true }
                : {
                    stroke: k.soft,
                    strokeWidth: 0.2,
                    roughness: 1,
                    disableMultiStroke: true,
                    strokeLineDash: [0.8, 0.7],
                  };
          return <RoughShape key={w.id} rc={rc} d={rc.linear(poly, style)} />;
        })}
        <RoughShape
          rc={rc}
          d={rc.curve(loop, {
            stroke: k.pink,
            strokeWidth: 0.6,
            strokeLineDash: [1.6, 0.9],
            roughness: 0.5,
          })}
        />
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.xy[0]}
            y={l.xy[1] - 0.8}
            fontSize={1.7}
            fontFamily={mono.fontFamily}
            fill={k.ink}
            textAnchor="middle"
            stroke="#fff"
            strokeWidth={0.5}
            paintOrder="stroke"
          >
            {l.name.toUpperCase()}
          </text>
        ))}
      </g>
      <RoughShape
        rc={rc}
        d={rc.rect(box.x, box.y, box.w, box.h, { stroke: k.ink, strokeWidth: 0.4 })}
      />
      {route.waypoints.map((w, i) => {
        const [x, y] = toXY(w.lat, w.lon);
        const f = featureById.get(w.featureId);
        return (
          <g key={w.featureId}>
            <circle cx={x} cy={y} r={2.1} fill="#fff" stroke={k.ink} strokeWidth={0.35} />
            <text
              x={x}
              y={y + 0.85}
              fontSize={2.4}
              textAnchor="middle"
              fontFamily={mono.fontFamily}
              fontWeight={500}
              fill={k.ink}
            >
              {i + 1}
            </text>
            <title>{f?.name ?? f?.kind}</title>
          </g>
        );
      })}
      <Star cx={cx} cy={cy} r={2.6} fill={k.pink} stroke={k.ink} />
      <Compass rc={rc} k={k} cx={box.x + box.w - 5} cy={box.y + 6} r={2.8} />
      <g aria-hidden>
        <line
          x1={box.x + 2}
          y1={box.y + box.h - 2.5}
          x2={box.x + 2 + barM / metersPerMm}
          y2={box.y + box.h - 2.5}
          stroke={k.ink}
          strokeWidth={0.5}
        />
        <text
          x={box.x + 2}
          y={box.y + box.h - 3.6}
          fontSize={1.7}
          fontFamily={mono.fontFamily}
          fill={k.ink}
          stroke="#fff"
          strokeWidth={0.4}
          paintOrder="stroke"
        >
          {barM} m
        </text>
      </g>
    </g>
  );
}

function niceBar(m: number): number {
  const steps = [25, 50, 100, 150, 200, 250, 300, 400, 500];
  let best = steps[0]!;
  for (const s of steps) if (s <= m) best = s;
  return best;
}
