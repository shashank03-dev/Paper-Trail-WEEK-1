"use client";
import { useEffect, useRef, type RefObject } from "react";
import { svgToCanvas } from "@/lib/client/raster";
import type { Rig } from "./StudioScene";
import { LiteFold, drawPaper, drawPencil, drawShadow } from "./liteFold";

/**
 * The hero still life drawn with Canvas 2D (see liteFold.ts): the same folding
 * sheet and pencil, driven by the same `rig`, for devices that skip WebGL
 * (Data Saver, 2G, no WebGL2) or whose WebGL failed, stalled or was lost. It
 * redraws only while something moves, so it costs nothing at rest.
 */
export default function LiteScene({
  rig,
  sheetId,
  active,
  mobile,
  onReady,
}: {
  rig: RefObject<Rig>;
  sheetId: string;
  active: boolean;
  mobile: boolean;
  onReady?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const print = useRef<HTMLCanvasElement | null>(null);
  const dirty = useRef(true);

  // The printed sheet, rasterised once at a resolution that suits a 2D canvas.
  useEffect(() => {
    let cancelled = false;
    const late = window.setTimeout(() => !cancelled && onReady?.(), 4000);
    void (async () => {
      await document.fonts.ready;
      const svg = document.getElementById(sheetId) as unknown as SVGSVGElement | null;
      if (svg) {
        try {
          const c = await svgToCanvas(svg, 4);
          if (cancelled) return;
          print.current = c;
          dirty.current = true;
        } catch {
          /* the paper still folds, just blank */
        }
      }
      window.clearTimeout(late);
      if (!cancelled) onReady?.();
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(late);
    };
  }, [sheetId, onReady]);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !active) return;
    const ctx = el.getContext("2d");
    // No 2D canvas either: let the error boundary show the printed sheet.
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    const shadowBuf = document.createElement("canvas");
    const fold = new LiteFold();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(el.clientWidth * dpr));
      const h = Math.max(1, Math.round(el.clientHeight * dpr));
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
        dirty.current = true;
      }
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);

    let last = performance.now();
    const t0 = last;
    let seen = "";
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const r = rig.current;
      if (!r) return;
      const dt = (now - last) / 1000;
      last = now;
      const still = reduce.matches;
      // Redraw only when the rig moved, the paper is still settling, or it's
      // floating (it bobs gently in the air).
      const key = `${r.top},${r.a},${r.b},${r.c},${r.x},${r.y},${r.z},${r.s},${r.rx},${r.ry},${r.rz},${r.fx},${r.fy},${r.away},${r.penX},${r.penY},${r.penS}`;
      const floating = !still && r.z > 0.005;
      if (key === seen && !fold.moving && !floating && !dirty.current) return;
      seen = key;
      dirty.current = false;
      const { width: w, height: h } = el;
      const quads = fold.frame(r, dt, (now - t0) / 1000, w, h, still);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      drawShadow(ctx, shadowBuf, quads, Math.min(1, Math.max(0, r.z / 0.6)));
      const img = print.current;
      drawPaper(ctx, quads, img, img?.width ?? 1, img?.height ?? 1);
      drawPencil(ctx, r, mobile, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active, mobile, rig]);

  return <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />;
}
