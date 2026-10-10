"use client";
import { useRef } from "react";
import { Sheet } from "@/lib/zine/Sheet";
import { sheetGeometry, type PageNo } from "@/lib/zine/layout";
import type { ZineData } from "@/lib/zine/primitives";

/** The sheet on the desk: tilts toward the pointer in 3D; optional per-panel re-roll buttons. */
export function SheetStage({
  data,
  pending,
  onReroll,
  rerolling,
  svgId,
}: {
  data: ZineData;
  pending?: PageNo[];
  onReroll?: (page: PageNo) => void;
  rerolling?: PageNo | null;
  svgId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const g = sheetGeometry(data.paper);
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.classList.add("tilting");
    ref.current.style.setProperty("--ry", `${x * 7}deg`);
    ref.current.style.setProperty("--rx", `${-y * 6}deg`);
  };
  const reset = () => {
    ref.current?.style.setProperty("--ry", "0deg");
    ref.current?.style.setProperty("--rx", "0deg");
    window.setTimeout(() => ref.current?.classList.remove("tilting"), 520);
  };
  return (
    <div className="stage w-full" onPointerMove={onMove} onPointerLeave={reset}>
      <div ref={ref} className="tilt relative">
        <div className="sheet-shadow relative overflow-hidden rounded-[3px] bg-card">
          <Sheet data={data} pending={pending} className="sheet-svg" id={svgId} />
          {onReroll &&
            ([1, 3, 4, 5, 6, 7, 8] as PageNo[]).map((p) => {
              const c = g.cells[p];
              return (
                <button
                  key={p}
                  type="button"
                  className="no-print absolute grid place-items-start p-1 opacity-0 transition-opacity focus-visible:opacity-100 [@media(hover:hover)]:hover:opacity-100"
                  style={{
                    left: `${(c.x / g.w) * 100}%`,
                    top: `${(c.y / g.h) * 100}%`,
                    width: `${(c.w / g.w) * 100}%`,
                    height: `${(c.h / g.h) * 100}%`,
                  }}
                  onClick={() => onReroll(p)}
                  disabled={!!rerolling || pending?.includes(p)}
                  aria-label={`Regenerate page ${p}`}
                >
                  <span
                    className={`mono rounded-md border-2 border-ink bg-sun px-2 py-1 text-[0.7rem] font-semibold shadow-[0_2px_0_var(--color-ink)] ${rerolling === p ? "animate-pulse" : ""}`}
                  >
                    ↻ {rerolling === p ? "re-writing…" : `re-roll p.${p}`}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
