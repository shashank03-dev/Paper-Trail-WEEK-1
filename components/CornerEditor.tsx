"use client";
import { useRef, useState } from "react";
import type { Pt } from "@/lib/vision/homography";

const NAMES = ["top-left", "top-right", "bottom-right", "bottom-left"];

/** The photo with four draggable (and keyboard-movable) corner handles. */
export function CornerEditor({
  src,
  width,
  height,
  corners,
  onChange,
  snapped,
}: {
  src: string;
  width: number;
  height: number;
  corners: Pt[];
  onChange: (c: Pt[]) => void;
  snapped: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const toImg = (e: React.PointerEvent): Pt => {
    const r = svg.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * width,
      y: ((e.clientY - r.top) / r.height) * height,
    };
  };
  const move = (i: number, p: Pt) =>
    onChange(
      corners.map((c, j) =>
        j === i
          ? { x: Math.max(0, Math.min(width, p.x)), y: Math.max(0, Math.min(height, p.y)) }
          : c,
      ),
    );
  const r = Math.max(width, height) / 70;
  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border-2 border-ink bg-ink">
      <img
        src={src}
        alt="Your photo of the sheet"
        className="block h-auto w-full select-none"
        draggable={false}
      />
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerMove={(e) => drag !== null && move(drag, toImg(e))}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        <polygon
          points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="rgb(255 92 138 / .12)"
          stroke="#FF5C8A"
          strokeWidth={r / 3}
          strokeDasharray={`${r} ${r / 2}`}
        />
        {corners.map((c, i) => (
          <g
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={`${NAMES[i]} corner marker`}
            aria-valuetext={`x ${Math.round(c.x)}, y ${Math.round(c.y)}`}
            aria-valuenow={Math.round(c.x)}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag(i);
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? r * 2 : r / 3;
              const d = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
              }[e.key];
              if (d) {
                e.preventDefault();
                move(i, { x: c.x + d[0]!, y: c.y + d[1]! });
              }
            }}
            style={{
              cursor: "grab",
              transition: snapped ? "transform 400ms cubic-bezier(.2,1.4,.4,1)" : undefined,
            }}
          >
            <circle
              cx={c.x}
              cy={c.y}
              r={r * 1.6}
              fill="rgb(255 255 255 / .25)"
              stroke="#fff"
              strokeWidth={r / 4}
            />
            <circle
              cx={c.x}
              cy={c.y}
              r={r * 0.45}
              fill={snapped ? "#1F8A8A" : "#FF5C8A"}
              stroke="#fff"
              strokeWidth={r / 6}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
