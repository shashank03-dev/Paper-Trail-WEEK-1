import { panelTransform, PAGES, sheetGeometry, FIDUCIAL_INNER, type PageNo } from "./layout";
import { makeRough, hashSeed } from "./rough";
import { inks, type ZineData } from "./primitives";
import { Folio, PANEL_COMPONENTS } from "./panels";
import { Scissors } from "./glyphs";

export interface SheetProps {
  data: ZineData;
  /** Pages still being written (shown as an inked placeholder on screen only). */
  pending?: PageNo[];
  className?: string;
  /** Show a cream paper background (screen only; print uses the real paper). */
  paperBg?: boolean;
  id?: string;
  title?: string;
}

/** The whole printable sheet as one SVG, in millimetres. */
export function Sheet({ data, pending = [], className, paperBg = true, id, title }: SheetProps) {
  const g = sheetGeometry(data.paper);
  const k = inks(data.color);
  const featureById = new Map(data.features.map((f) => [f.id, f]));
  const seed = hashSeed(data.id);
  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${g.w} ${g.h}`}
      width={`${g.w}mm`}
      height={`${g.h}mm`}
      className={className}
      role="img"
      aria-label={title ?? `Paper Trail zine: ${data.plan?.title ?? "a trail being written"}`}
      data-paper={data.paper}
    >
      <rect
        className="sheet-bg"
        x={0}
        y={0}
        width={g.w}
        height={g.h}
        fill={paperBg ? "#FFFDF8" : "#FFFFFF"}
      />
      {PAGES.map((page) => {
        const Panel = PANEL_COMPONENTS[page];
        const isPending = pending.includes(page);
        // Each panel gets its own seed so re-rolling one panel doesn't re-wobble the rest.
        const rc = makeRough(seed + page * 104729);
        return (
          <g
            key={page}
            transform={panelTransform(g, page)}
            data-page={page}
            className={isPending ? "panel panel-pending" : "panel panel-done"}
          >
            {isPending ? (
              <PendingPanel w={g.panelW} h={g.panelH} page={page} />
            ) : (
              <Panel d={data} g={g} rc={rc} k={k} featureById={featureById} />
            )}
            <Folio p={{ d: data, g, rc, k, featureById }} n={page} />
          </g>
        );
      })}
      {/* The one cut. */}
      <line
        x1={g.cut.x1}
        y1={g.cut.y1}
        x2={g.cut.x2}
        y2={g.cut.y2}
        stroke="#1B1B1B"
        strokeWidth={0.3}
        strokeDasharray="2 1.4"
      />
      <Scissors x={g.cut.x1 - 1} y={g.cut.y1} s={4} color="#1B1B1B" />
      {/* Fiducials for photo alignment on return. */}
      {g.fiducials.map((f) => (
        <g key={f.corner} data-fiducial={f.corner}>
          <rect x={f.x - 1} y={f.y - 1} width={f.size + 2} height={f.size + 2} fill="#FFFFFF" />
          <rect x={f.x} y={f.y} width={f.size} height={f.size} fill="#000000" />
          <rect
            x={f.cx - FIDUCIAL_INNER / 2}
            y={f.cy - FIDUCIAL_INNER / 2}
            width={FIDUCIAL_INNER}
            height={FIDUCIAL_INNER}
            fill="#FFFFFF"
          />
        </g>
      ))}
    </svg>
  );
}

function PendingPanel({ w, h, page }: { w: number; h: number; page: PageNo }) {
  return (
    <g>
      <rect
        x={3}
        y={3}
        width={w - 6}
        height={h - 6}
        fill="#F4EFE4"
        stroke="#d8cfbd"
        strokeWidth={0.3}
        strokeDasharray="1.2 1"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          className="ink-bar"
          x={9}
          y={14 + i * 9}
          width={(w - 18) * (i % 3 === 2 ? 0.6 : 1)}
          height={3}
          rx={1.5}
          fill="#e6dccb"
          style={{ animationDelay: `${(i + page) * 90}ms` }}
        />
      ))}
    </g>
  );
}
