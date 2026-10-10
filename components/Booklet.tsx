"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageSvg } from "@/lib/zine/PageSvg";
import { sheetGeometry, type PageNo } from "@/lib/zine/layout";
import type { ZineData } from "@/lib/zine/primitives";
import { svgToCanvas } from "@/lib/client/raster";

/** Spreads of the folded booklet: [1] [2|3] [4|5] [6|7] [8]. */
const SPREADS: (PageNo | null)[][] = [
  [null, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [8, null],
];
const STRIPS = 10;
const DURATION = 950;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * The folded booklet with a page that bends as it turns. The turning leaf is a
 * chain of nested strips; each one rotates a little further than the one it
 * hangs from, so the free edge leads and the paper curls like paper.
 * Turn with the buttons, the arrow keys, or by dragging a page corner.
 */
export function Booklet({ data }: { data: ZineData }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = sheetGeometry(data.paper);
  const aspect = (g.panelW * 2) / g.panelH;
  const [i, setI] = useState(0);
  const [turn, setTurn] = useState<null | "fwd" | "back">(null);
  const [images, setImages] = useState<Partial<Record<PageNo, string>> | null>(null);
  const strips = useRef<(HTMLDivElement | null)[]>([]);
  const shades = useRef<(HTMLSpanElement | null)[]>([]);
  const under = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const raf = useRef(0);
  const drag = useRef<{ x: number; w: number; dir: "fwd" | "back" } | null>(null);

  // Rasterise each page once; the bending leaf is drawn from these.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await document.fonts.ready;
      const out: Partial<Record<PageNo, string>> = {};
      for (const p of [1, 2, 3, 4, 5, 6, 7, 8] as PageNo[]) {
        const svg = document.getElementById(`${uid}-p${p}`) as unknown as SVGSVGElement | null;
        if (!svg) continue;
        try {
          out[p] = (await svgToCanvas(svg, 6)).toDataURL("image/jpeg", 0.9);
        } catch {
          /* that page turns as blank paper */
        }
      }
      if (!cancelled) setImages(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, data]);

  const cur = SPREADS[i]!;
  const next = SPREADS[Math.min(SPREADS.length - 1, i + 1)]!;
  const prev = SPREADS[Math.max(0, i - 1)]!;
  // Forward: the leaf carries cur-right (front) and next-left (back). Backward: prev-right and cur-left.
  const leafFront = turn === "back" ? prev[1] : cur[1];
  const leafBack = turn === "back" ? cur[0] : next[0];
  const left = turn === "back" ? prev[0] : cur[0];
  const right = turn === "fwd" ? next[1] : cur[1];

  /** Pose the leaf for turn progress t (0 = lying right, 1 = lying left). */
  const pose = useCallback((t: number) => {
    progress.current = t;
    const total = -180 * t;
    const bend = Math.sin(Math.PI * t) * 34; // degrees of curl spread along the page
    const step = bend / (STRIPS - 1);
    const root = Math.max(-180, Math.min(0, total + bend / 2));
    let acc = 0;
    strips.current.forEach((el, k) => {
      if (!el) return;
      const a = k === 0 ? root : -step;
      acc += a;
      el.style.transform = `rotateY(${a}deg)`;
      const s = shades.current[k];
      if (s) s.style.opacity = String(Math.abs(Math.sin((acc * Math.PI) / 180)) * 0.28);
    });
    if (under.current) under.current.style.opacity = String(Math.sin(Math.PI * t) * 0.9);
  }, []);

  const finish = useCallback(
    (dir: "fwd" | "back", from: number, to: number) => {
      cancelAnimationFrame(raf.current);
      const start = performance.now();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dur = reduce ? 1 : DURATION * Math.max(0.35, Math.abs(to - from));
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / dur);
        pose(from + (to - from) * easeInOut(k));
        if (k < 1) raf.current = requestAnimationFrame(tick);
        else {
          const done = dir === "fwd" ? to === 1 : to === 0;
          if (done) setI((v) => v + (dir === "fwd" ? 1 : -1));
          setTurn(null);
        }
      };
      raf.current = requestAnimationFrame(tick);
    },
    [pose],
  );

  const go = (dir: 1 | -1) => {
    const n = i + dir;
    if (n < 0 || n >= SPREADS.length || turn || !images) return;
    const d = dir === 1 ? "fwd" : "back";
    setTurn(d);
    requestAnimationFrame(() => {
      pose(d === "fwd" ? 0 : 1);
      finish(d, d === "fwd" ? 0 : 1, d === "fwd" ? 1 : 0);
    });
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (turn || !images) return;
    const r = e.currentTarget.getBoundingClientRect();
    const onRight = e.clientX > r.left + r.width / 2;
    const dir = onRight ? "fwd" : "back";
    if ((dir === "fwd" && i >= SPREADS.length - 1) || (dir === "back" && i <= 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: r.width, dir };
    setTurn(dir);
    requestAnimationFrame(() => pose(dir === "fwd" ? 0 : 1));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.w;
    pose(d.dir === "fwd" ? Math.min(1, Math.max(0, -dx)) : Math.min(1, Math.max(0, 1 - dx)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const t = progress.current;
    if (d.dir === "fwd") finish("fwd", t, t > 0.3 ? 1 : 0);
    else finish("back", t, t < 0.7 ? 0 : 1);
  };

  const face = (p: PageNo | null | undefined, k: number, back = false) => {
    const src = p ? images?.[p] : undefined;
    const slot = back ? STRIPS - 1 - k : k;
    return (
      <div className={`curl-face ${back ? "back" : ""} ${p ? "" : "!bg-transparent"}`}>
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute top-0 h-full max-w-none select-none"
            style={{ width: `${STRIPS * 100}%`, left: `${-slot * 100}%` }}
          />
        )}
        {p && !src && <div className="absolute inset-0 bg-[#fffdf8]" />}
      </div>
    );
  };

  // The nested chain of strips, built inside-out.
  let chain: React.ReactNode = null;
  for (let k = STRIPS - 1; k >= 0; k--) {
    chain = (
      <div
        key={k}
        ref={(el) => void (strips.current[k] = el)}
        className="curl-strip"
        style={{
          left: k === 0 ? 0 : "100%",
          width: k === 0 ? `${100 / STRIPS}%` : "100%",
          transform: k === 0 && turn === "back" ? "rotateY(-180deg)" : undefined,
        }}
      >
        {face(leafFront, k)}
        {face(leafBack, k, true)}
        <span
          ref={(el) => void (shades.current[k] = el)}
          className="pointer-events-none absolute inset-0 bg-ink opacity-0"
          aria-hidden
        />
        {chain}
      </div>
    );
  }

  const label = cur.filter(Boolean).join(" · ");
  return (
    <div className="flex flex-col items-center gap-6">
      <div
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 w-[300px] opacity-0"
      >
        {([1, 2, 3, 4, 5, 6, 7, 8] as PageNo[]).map((p) => (
          <PageSvg key={p} id={`${uid}-p${p}`} data={data} page={p} />
        ))}
      </div>
      <div
        className="booklet w-full max-w-[720px] touch-pan-y select-none"
        onKeyDown={(e) => (e.key === "ArrowRight" ? go(1) : e.key === "ArrowLeft" ? go(-1) : null)}
        tabIndex={0}
        aria-label="Folded booklet preview. Use the arrow keys to turn pages, or drag a page corner."
        role="region"
      >
        <div
          className="relative mx-auto grid grid-cols-2 [transform-style:preserve-3d]"
          style={{
            aspectRatio: String(aspect),
            filter: "drop-shadow(0 30px 40px rgb(21 20 18 / .28))",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className={`relative overflow-hidden ${left ? "bg-[#fffdf8]" : ""}`}>
            {left && <PageSvg data={data} page={left} className="block h-full w-full" />}
            {left && (
              <span className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ink/12 to-transparent" />
            )}
          </div>
          <div className={`relative overflow-hidden ${right ? "bg-[#fffdf8]" : ""}`}>
            {right && <PageSvg data={data} page={right} className="block h-full w-full" />}
            {right && (
              <span className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-ink/12 to-transparent" />
            )}
            {turn && (
              <div
                ref={under}
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/25 via-ink/5 to-transparent opacity-0"
              />
            )}
          </div>
          {turn && (
            <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1/2 [transform-style:preserve-3d]">
              {chain}
            </div>
          )}
          {/* A dog-ear hint on the free corner. */}
          {!turn && i < SPREADS.length - 1 && (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 right-0 h-8 w-8 bg-[linear-gradient(135deg,transparent_50%,rgb(21_20_18/0.12)_50%,rgb(255_253_248)_62%)]"
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => go(-1)}
          disabled={i === 0 || !!turn || !images}
        >
          <ArrowLeft size={15} /> Back
        </button>
        <span className="mono num min-w-[5.5rem] text-center text-sm text-ink-2" aria-live="polite">
          {label} / 8
        </span>
        <button
          type="button"
          className="btn btn-ink btn-sm"
          onClick={() => go(1)}
          disabled={i === SPREADS.length - 1 || !!turn || !images}
        >
          Turn <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
