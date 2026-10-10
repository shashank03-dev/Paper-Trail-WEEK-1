"use client";
import Link from "next/link";
import { use } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PrintPortal } from "@/components/PrintPortal";
import { db, type TrailRecord } from "@/lib/client/db";
import { fmtDuration } from "@/lib/client/trail";
import { fitText } from "@/lib/zine/text";
import { PAPER_MM } from "@/lib/zine/layout";
import { TextBlock } from "@/lib/zine/primitives";

/** A one-page reply postcard from The Trail Office (a nod to the I-Spy reward-by-mail). */
function Postcard({ t }: { t: TrailRecord }) {
  const { w, h } = PAPER_MM[t.paper];
  // A 6×4 in postcard centred on the sheet, with crop marks.
  const cw = 152.4;
  const ch = 101.6;
  const x = (w - cw) / 2;
  const y = (h - ch) / 2;
  const letter = fitText(t.report?.letter ?? "", {
    font: "display-400i",
    maxSize: 4,
    minSize: 2.6,
    maxW: cw / 2 - 14,
    maxH: ch - 34,
    lineHeight: 1.3,
  });
  const date = new Date(t.returnedAt ?? Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={`${w}mm`}
      height={`${h}mm`}
      className="sheet-svg"
      role="img"
      aria-label="Reply postcard"
    >
      <rect className="sheet-bg" width={w} height={h} fill="#FFFDF8" />
      {[
        [x, y],
        [x + cw, y],
        [x, y + ch],
        [x + cw, y + ch],
      ].map(([a, b], i) => (
        <g key={i} stroke="#1B1B1B" strokeWidth={0.2}>
          <line x1={a! - 8} y1={b} x2={a! - 3} y2={b} />
          <line x1={a! + 3} y1={b} x2={a! + 8} y2={b} />
          <line x1={a} y1={b! - 8} x2={a} y2={b! - 3} />
          <line x1={a} y1={b! + 3} x2={a} y2={b! + 8} />
        </g>
      ))}
      <rect x={x} y={y} width={cw} height={ch} fill="#fff" stroke="#1B1B1B" strokeWidth={0.3} />
      <rect
        x={x + 3}
        y={y + 3}
        width={cw - 6}
        height={ch - 6}
        fill="none"
        stroke="#FF5C8A"
        strokeWidth={0.6}
      />
      <text x={x + 9} y={y + 15} fontFamily="Fraunces" fontWeight={700} fontSize={7}>
        From The Trail Office
      </text>
      <text x={x + 9} y={y + 21} fontFamily="IBM Plex Mono" fontSize={2.6} fill="#6a6357">
        {date} · re: {t.plan?.title}
      </text>
      <TextBlock x={x + 9} y={y + 26} fit={letter} font="display-400i" fill="#1B1B1B" />
      <line
        x1={x + cw / 2}
        y1={y + 12}
        x2={x + cw / 2}
        y2={y + ch - 12}
        stroke="#1B1B1B"
        strokeWidth={0.3}
      />
      <g transform={`translate(${x + cw - 34} ${y + 10}) rotate(-8 12 10)`}>
        <rect width={24} height={20} fill="none" stroke="#FF5C8A" strokeWidth={0.8} />
        <text
          x={12}
          y={9}
          textAnchor="middle"
          fontFamily="Fraunces"
          fontWeight={700}
          fontSize={6}
          fill="#FF5C8A"
        >
          {t.score?.total ?? 0}
        </text>
        <text
          x={12}
          y={15}
          textAnchor="middle"
          fontFamily="IBM Plex Mono"
          fontSize={2.4}
          fill="#FF5C8A"
        >
          POINTS
        </text>
      </g>
      {[
        `Spotted ${t.score?.spotted ?? 0} of ${t.score?.of ?? 0}`,
        `Outside ${t.outsideMs ? fmtDuration(t.outsideMs) : "—"}`,
        `Edition No. ${String(t.edition).padStart(3, "0")}`,
        t.walkerName ? `To: ${t.walkerName}` : "To: the walker",
      ].map((l, i) => (
        <g key={i}>
          <text x={x + cw / 2 + 8} y={y + 48 + i * 11} fontFamily="Caveat" fontSize={6}>
            {l}
          </text>
          <line
            x1={x + cw / 2 + 8}
            y1={y + 50 + i * 11}
            x2={x + cw - 9}
            y2={y + 50 + i * 11}
            stroke="#d9cfbc"
            strokeWidth={0.3}
          />
        </g>
      ))}
    </svg>
  );
}

export default function PostcardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useLiveQuery(
    () =>
      db()
        .trails.get(id)
        .then((x) => x ?? null),
    [id],
  );
  if (t === undefined) return null;
  if (!t?.report)
    return (
      <p className="mx-auto max-w-xl px-6 pb-20 pt-40 text-center text-fg-2">
        No field report yet.{" "}
        <Link className="underline" href={`/return/${id}`}>
          Read your sheet first.
        </Link>
      </p>
    );
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-32 sm:px-8 sm:pt-36">
      <div className="flex items-end justify-between gap-4">
        <h1 className="display text-[clamp(2.4rem,1.6rem+3vw,4rem)]">Reply postcard</h1>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Print postcard
        </button>
      </div>
      <div className="paper mt-8 overflow-hidden">
        <Postcard t={t} />
      </div>
      <PrintPortal paper={t.paper}>
        <Postcard t={t} />
      </PrintPortal>
    </div>
  );
}
