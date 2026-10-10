"use client";
import { useEffect, useState } from "react";
import { PrintPortal } from "@/components/PrintPortal";
import {
  FIDUCIAL_INNER,
  IMPOSITION,
  PAGES,
  panelTransform,
  sheetGeometry,
} from "@/lib/zine/layout";
import { defaultPaper } from "@/lib/client/settings";
import type { Paper } from "@/lib/schemas";

/** Big page numbers only, so you can check the fold physically. */
function FoldTestSheet({ paper }: { paper: Paper }) {
  const g = sheetGeometry(paper);
  return (
    <svg
      viewBox={`0 0 ${g.w} ${g.h}`}
      width={`${g.w}mm`}
      height={`${g.h}mm`}
      className="sheet-svg"
      role="img"
      aria-label="Fold test sheet with page numbers 1 to 8"
    >
      <rect className="sheet-bg" width={g.w} height={g.h} fill="#FFFDF8" />
      {PAGES.map((p) => (
        <g key={p} transform={panelTransform(g, p)}>
          <rect
            x={3}
            y={3}
            width={g.panelW - 6}
            height={g.panelH - 6}
            fill="none"
            stroke="#1B1B1B"
            strokeWidth={0.3}
            strokeDasharray="1.5 1"
          />
          <text
            x={g.panelW / 2}
            y={g.panelH / 2 + 14}
            textAnchor="middle"
            fontFamily="Fraunces"
            fontWeight={700}
            fontSize={44}
            fill={p === 1 ? "#FF5C8A" : "#1B1B1B"}
          >
            {p}
          </text>
          <text x={g.panelW / 2} y={12} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={3}>
            {p === 1 ? "front cover" : p === 8 ? "back cover" : `page ${p}`} · ↑ top
          </text>
        </g>
      ))}
      <line
        x1={g.cut.x1}
        y1={g.cut.y1}
        x2={g.cut.x2}
        y2={g.cut.y2}
        stroke="#1B1B1B"
        strokeWidth={0.4}
        strokeDasharray="2 1.4"
      />
      {g.fiducials.map((f) => (
        <g key={f.corner}>
          <rect x={f.x} y={f.y} width={f.size} height={f.size} fill="#000" />
          <rect
            x={f.cx - FIDUCIAL_INNER / 2}
            y={f.cy - FIDUCIAL_INNER / 2}
            width={FIDUCIAL_INNER}
            height={FIDUCIAL_INNER}
            fill="#fff"
          />
        </g>
      ))}
    </svg>
  );
}

export default function FoldTest() {
  const [paper, setPaper] = useState<Paper>("letter");
  useEffect(() => setPaper(defaultPaper()), []);
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6">
      <p className="kicker">Print this first if you&rsquo;re unsure</p>
      <h1 className="display riso mt-1 text-4xl">Fold test</h1>
      <p className="mt-3 max-w-2xl text-ink/80">
        Print, cut the dashed line, fold. Flip through: you should read 1 → 8 in order, all upright.
        If not, the fix is one table: <code className="mono">IMPOSITION</code> in{" "}
        <code className="mono">lib/zine/layout.ts</code>.
      </p>
      <div className="mt-4 flex gap-2">
        {(["letter", "a4"] as Paper[]).map((p) => (
          <button
            key={p}
            type="button"
            className="chip"
            aria-pressed={paper === p}
            onClick={() => setPaper(p)}
          >
            {p === "letter" ? "US Letter" : "A4"}
          </button>
        ))}
        <button
          type="button"
          className="btn btn-primary btn-sm ml-auto"
          onClick={() => window.print()}
        >
          Print fold test
        </button>
      </div>
      <div className="paper-card mt-6 overflow-hidden">
        <FoldTestSheet paper={paper} />
      </div>
      <p className="mono mt-3 text-xs text-muted">
        Layout: top row{" "}
        {[0, 1, 2, 3]
          .map((c) => PAGES.find((p) => IMPOSITION[p].row === 0 && IMPOSITION[p].col === c))
          .join(" ")}{" "}
        (upside down) · bottom row{" "}
        {[0, 1, 2, 3]
          .map((c) => PAGES.find((p) => IMPOSITION[p].row === 1 && IMPOSITION[p].col === c))
          .join(" ")}
      </p>
      <PrintPortal paper={paper}>
        <FoldTestSheet paper={paper} />
      </PrintPortal>
    </div>
  );
}
