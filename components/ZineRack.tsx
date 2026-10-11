"use client";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PageSvg } from "@/lib/zine/PageSvg";
import type { ZineData } from "@/lib/zine/primitives";
import { svgToCanvas } from "@/lib/client/raster";
import { rackSize } from "./rackLayout";
import { deviceTier } from "@/lib/client/device";

const Scene = dynamic(() => import("./ZineRackScene"), { ssr: false });

export interface RackZine {
  id: string;
  data: ZineData;
  title: string;
  meta: string;
  /** Points to stamp on the cover once the walk has been read. */
  points?: number;
}

/** Ink a Trail Office stamp onto a cover, the way it looks in the Field Report. */
function stamp(c: HTMLCanvasElement, points: number) {
  const g = c.getContext("2d")!;
  const w = c.width;
  g.save();
  g.translate(w * 0.69, c.height * 0.12);
  g.rotate(0.12);
  g.globalAlpha = 0.85;
  g.strokeStyle = g.fillStyle = "#c8402a";
  const bw = w * 0.42;
  const bh = w * 0.22;
  g.lineWidth = w * 0.008;
  g.beginPath();
  g.roundRect(-bw / 2, -bh / 2, bw, bh, w * 0.025);
  g.stroke();
  g.beginPath();
  g.roundRect(-bw / 2 + w * 0.014, -bh / 2 + w * 0.014, bw - w * 0.028, bh - w * 0.028, w * 0.018);
  g.stroke();
  g.textAlign = "center";
  g.font = `${w * 0.075}px "Instrument Serif", Georgia, serif`;
  g.fillText(`${points} pts`, 0, w * 0.02);
  g.font = `${w * 0.028}px "Fragment Mono", monospace`;
  g.fillText("WALKED", 0, w * 0.068);
  g.restore();
}

function hasWebGL(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

/** The 3D shelf. Decorative for assistive tech: every zine on it is also a link in a list nearby. */
export function ZineRack({
  zines,
  onOpen,
  maxCols = 5,
}: {
  zines: RackZine[];
  onOpen: (id: string) => void;
  maxCols?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const [covers, setCovers] = useState<Record<string, HTMLCanvasElement>>({});
  const [cols, setCols] = useState(maxCols);
  const [gl, setGl] = useState<boolean | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [active, setActive] = useState(false);
  const [low, setLow] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const key = zines.map((z) => `${z.id}:${z.points ?? ""}:${z.title}`).join("|");

  useEffect(() => {
    const t = deviceTier();
    setLow(t === "low");
    setGl(t !== "lite" && hasWebGL());
    const set = () => {
      const w = box.current?.clientWidth ?? window.innerWidth;
      setCols(Math.max(2, Math.min(maxCols, Math.floor(w / 190))));
    };
    set();
    const ro = new ResizeObserver(set);
    // Only draw frames while the shelf is on screen.
    const io = new IntersectionObserver(([e]) => setActive(!!e?.isIntersecting), {
      rootMargin: "80px",
    });
    if (box.current) {
      ro.observe(box.current);
      io.observe(box.current);
    }
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [maxCols]);

  useEffect(() => {
    if (!gl) return; // the hidden covers only render once WebGL is confirmed
    let cancelled = false;
    void (async () => {
      await document.fonts.ready;
      const out: Record<string, HTMLCanvasElement> = {};
      for (const z of zines) {
        const svg = document.getElementById(`${uid}-${z.id}`) as unknown as SVGSVGElement | null;
        if (!svg) continue;
        try {
          const c = await svgToCanvas(svg, 7);
          if (z.points !== undefined) stamp(c, z.points);
          out[z.id] = c;
        } catch {
          /* blank cover */
        }
        if (cancelled) return;
      }
      setCovers(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid, gl]);

  const { c, w, h } = rackSize(zines.length, cols);
  const hz = hover ? zines.find((z) => z.id === hover.id) : null;
  if (gl === false) return null;
  return (
    <div ref={box} className="relative w-full" aria-hidden>
      <div className="relative mx-auto" style={{ maxWidth: `${c * 210 + 170}px` }}>
        {gl && (
          <div className="pointer-events-none fixed -left-[9999px] top-0 w-[400px] opacity-0">
            {zines.map((z) => (
              <PageSvg key={z.id} id={`${uid}-${z.id}`} data={z.data} page={1} />
            ))}
          </div>
        )}
        <div style={{ aspectRatio: `${w} / ${h}` }} className="w-full">
          {gl && (
            <Scene
              items={zines.map((z) => ({ id: z.id, cover: covers[z.id] ?? null }))}
              cols={cols}
              active={active}
              low={low}
              onOpen={onOpen}
              onHover={(id, x, y) => setHover(id ? { id, x, y } : null)}
            />
          )}
        </div>
        <AnimatePresence>
          {hz && hover && (
            <motion.div
              key="tag"
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="glass pointer-events-none absolute z-10 max-w-[16rem] rounded-2xl px-4 py-3"
              style={{ left: hover.x + 18, top: hover.y + 18 }}
            >
              <p className="label">{hz.meta}</p>
              <p className="title mt-1 text-[1.25rem]">{hz.title}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
