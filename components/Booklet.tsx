"use client";
import { useState } from "react";
import { PageSvg } from "@/lib/zine/PageSvg";
import type { PageNo } from "@/lib/zine/layout";
import type { ZineData } from "@/lib/zine/primitives";

/** Spreads of the folded booklet: [1] [2|3] [4|5] [6|7] [8]. */
const SPREADS: (PageNo | null)[][] = [
  [null, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, null],
];

/** The folded booklet, with a 3D page turn. */
export function Booklet({ data }: { data: ZineData }) {
  const [i, setI] = useState(0);
  const [turning, setTurning] = useState<null | "fwd" | "back">(null);
  const go = (dir: 1 | -1) => {
    const n = i + dir;
    if (n < 0 || n >= SPREADS.length || turning) return;
    setTurning(dir === 1 ? "fwd" : "back");
    window.setTimeout(() => {
      setI(n);
      setTurning(null);
    }, 900);
  };
  const cur = SPREADS[i]!;
  const next = SPREADS[Math.min(SPREADS.length - 1, i + 1)]!;
  const prev = SPREADS[Math.max(0, i - 1)]!;
  // While turning forward the leaf carries cur-right (front) and next-left (back).
  const left = turning === "back" ? prev[0] : cur[0];
  const right = turning === "fwd" ? next[1] : cur[1];
  const Page = ({ p }: { p: PageNo | null | undefined }) =>
    p ? (
      <PageSvg data={data} page={p} className="block h-full w-full" />
    ) : (
      <div className="h-full w-full" />
    );
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="booklet w-full max-w-[640px]"
        onKeyDown={(e) => (e.key === "ArrowRight" ? go(1) : e.key === "ArrowLeft" ? go(-1) : null)}
        tabIndex={0}
        aria-label="Folded booklet preview. Use the arrow keys to turn pages."
        role="region"
      >
        <div
          className="spread relative mx-auto grid aspect-[1.32] grid-cols-2"
          style={{ filter: "drop-shadow(0 20px 30px rgb(60 40 10 / .28))" }}
        >
          <div className={`relative ${left ? "bg-card" : ""}`}>
            <Page p={left} />
          </div>
          <div className={`relative ${right ? "bg-card" : ""}`}>
            <Page p={right} />
          </div>
          {turning === "back" && <BackLeaf front={cur[0]} back={prev[1]} Page={Page} />}
          {turning === "fwd" && <ForwardLeaf front={cur[1]} back={next[0]} Page={Page} />}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => go(-1)}
          disabled={i === 0 || !!turning}
        >
          ← Back
        </button>
        <span className="mono text-sm" aria-live="polite">
          {cur.filter(Boolean).join(" · ")} / 8
        </span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => go(1)}
          disabled={i === SPREADS.length - 1 || !!turning}
        >
          Turn →
        </button>
      </div>
    </div>
  );
}

function ForwardLeaf({
  front,
  back,
  Page,
}: {
  front: PageNo | null | undefined;
  back: PageNo | null | undefined;
  Page: (p: { p: PageNo | null | undefined }) => React.ReactElement;
}) {
  const [on, setOn] = useState(false);
  return (
    <div
      className={`leaf ${on ? "turned" : ""}`}
      ref={(el) => void (el && !on && requestAnimationFrame(() => setOn(true)))}
    >
      <div className="side front">
        <Page p={front} />
      </div>
      <div className="side back">
        <Page p={back} />
      </div>
    </div>
  );
}

function BackLeaf({
  front,
  back,
  Page,
}: {
  front: PageNo | null | undefined;
  back: PageNo | null | undefined;
  Page: (p: { p: PageNo | null | undefined }) => React.ReactElement;
}) {
  const [on, setOn] = useState(false);
  // Starts turned (showing `front` on its back side, on the left) and swings right.
  return (
    <div
      className={`leaf ${on ? "" : "turned instant"}`}
      ref={(el) =>
        void (el && !on && requestAnimationFrame(() => requestAnimationFrame(() => setOn(true))))
      }
    >
      <div className="side front">
        <Page p={back} />
      </div>
      <div className="side back">
        <Page p={front} />
      </div>
    </div>
  );
}
