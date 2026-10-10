"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/Reveal";

/*
 * The four fiducials in public/samples/filled-sheet.jpg (1800 × 1350), as found
 * by lib/vision/sheet.ts: top-left, top-right, bottom-right, bottom-left.
 */
const IMG = { w: 1800, h: 1350 };
const C = [
  { x: 0.13, y: 0.1704 },
  { x: 0.8697, y: 0.0694 },
  { x: 0.9106, y: 0.866 },
  { x: 0.1617, y: 0.895 },
].map((p) => ({ x: p.x * IMG.w, y: p.y * IMG.h }));

/** Bilinear point on the photographed sheet (u across, v down). */
function at(u: number, v: number) {
  const [a, b, c, d] = C as [(typeof C)[0], (typeof C)[0], (typeof C)[0], (typeof C)[0]];
  const top = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  const bot = { x: d.x + (c.x - d.x) * u, y: d.y + (c.y - d.y) * u };
  return { x: top.x + (bot.x - top.x) * v, y: top.y + (bot.y - top.y) * v };
}

const NOTES = [
  { u: 0.375, v: 0.25, label: "I-Spy · page 4", text: "7 of 9 ticked" },
  { u: 0.125, v: 0.25, label: "Listen · page 5", text: "“pigeons arguing”" },
  { u: 0.125, v: 0.75, label: "Riddle · page 6", text: "the drinking fountain ✓" },
  { u: 0.375, v: 0.75, label: "Sketch · page 7", text: "a palm tree, waving" },
];

/** One split-flap digit: each new value drops in over the old like a departure board. */
function Flap({ d }: { d: string }) {
  return (
    <span className="relative inline-grid h-[1.18em] w-[0.72em] place-items-center overflow-hidden rounded-[0.1em] bg-dark-2 shadow-[inset_0_-1px_0_rgb(255_255_255/0.06),0_6px_14px_-6px_rgb(0_0_0/0.7)] [perspective:300px]">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={d}
          initial={{ rotateX: -90, opacity: 0.3 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="num block origin-center"
        >
          {d}
        </motion.span>
      </AnimatePresence>
      <span
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/60"
        aria-hidden
      />
    </span>
  );
}

function Board({
  to,
  run,
  label,
  accent,
}: {
  to: number;
  run: boolean;
  label: string;
  accent?: boolean;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    let n = 0;
    const id = window.setInterval(
      () => {
        n += 1;
        setV(Math.min(to, n));
        if (n >= to) window.clearInterval(id);
      },
      Math.max(30, 1100 / to),
    );
    return () => window.clearInterval(id);
  }, [run, to]);
  const s = String(v).padStart(2, "0");
  return (
    <div>
      <p className="label !text-dark-fg-2">{label}</p>
      <p
        className={`mt-3 flex items-end gap-1 font-serif text-[clamp(3rem,2.2rem+3vw,4.6rem)] leading-none ${accent ? "text-safelight" : "text-dark-fg"}`}
        aria-label={`${to} minutes`}
      >
        <Flap d={s[0]!} />
        <Flap d={s[1]!} />
        <span className="mb-1 ml-2 font-sans text-base text-dark-fg-2">min</span>
      </p>
    </div>
  );
}

export function Darkroom() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-25% 0px" });
  const reduce = useReducedMotion();
  const show = inView || !!reduce;
  const quad = `M${C.map((p) => `${p.x} ${p.y}`).join(" L")} Z`;
  const grid: [ReturnType<typeof at>, ReturnType<typeof at>][] = [
    [at(0.25, 0), at(0.25, 1)],
    [at(0.5, 0), at(0.5, 1)],
    [at(0.75, 0), at(0.75, 1)],
    [at(0, 0.5), at(1, 0.5)],
  ];
  const spring = { type: "spring", stiffness: 240, damping: 18 } as const;
  return (
    <section
      data-surface="dark"
      aria-labelledby="dark-h"
      className="on-dark relative overflow-hidden bg-dark py-28 text-dark-fg sm:py-36"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_40%_at_25%_30%,rgba(255,106,77,0.13),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-[var(--gutter)] lg:grid-cols-[1.2fr_1fr]">
        <div ref={ref} className="relative">
          <div className="relative overflow-hidden rounded-[18px] shadow-[0_40px_90px_-40px_rgb(0_0_0/0.9)]">
            <img
              src="/samples/filled-sheet.jpg"
              alt="A filled-in Paper Trail sheet, photographed on a table"
              className="block w-full"
              loading="lazy"
              width={IMG.w}
              height={IMG.h}
            />
            {show && !reduce && (
              <div
                className="scan pointer-events-none absolute inset-0"
                style={{ animationIterationCount: 1 }}
              />
            )}
            <svg
              viewBox={`0 0 ${IMG.w} ${IMG.h}`}
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <motion.path
                d={quad}
                fill="rgba(255,106,77,0.06)"
                stroke="#ff6a4d"
                strokeWidth="5"
                strokeDasharray="22 14"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={show ? { pathLength: 1, opacity: 1 } : {}}
                transition={{ duration: 1.2, delay: 1.3, ease: [0.76, 0, 0.24, 1] }}
              />
              {grid.map(([a, b], i) => (
                <motion.line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#ff6a4d"
                  strokeOpacity=".75"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={show ? { pathLength: 1 } : {}}
                  transition={{ duration: 0.8, delay: 2.2 + i * 0.12 }}
                />
              ))}
              {C.map((p, i) => {
                const sx = i === 0 || i === 3 ? 1 : -1;
                const sy = i < 2 ? 1 : -1;
                return (
                  <motion.path
                    key={i}
                    d={`M${p.x - 34 * sx} ${p.y + 34 * sy} V${p.y - 34 * sy} H${p.x + 34 * sx}`}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="7"
                    strokeLinecap="round"
                    initial={{ opacity: 0, scale: 1.8 }}
                    animate={show ? { opacity: 1, scale: 1 } : {}}
                    style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: "view-box" }}
                    transition={{ ...spring, delay: 0.6 + i * 0.12 }}
                  />
                );
              })}
            </svg>
          </div>
          {NOTES.map((n, i) => {
            const p = at(n.u, n.v);
            return (
              <motion.div
                key={n.label}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-dark/85 px-3.5 py-2.5 shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_16px_30px_-12px_rgb(0_0_0/0.8)] backdrop-blur-md"
                style={{ left: `${(p.x / IMG.w) * 100}%`, top: `${(p.y / IMG.h) * 100}%` }}
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={show ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.8, delay: 2.9 + i * 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="mono whitespace-nowrap text-[0.6rem] uppercase tracking-[0.1em] text-safelight">
                  {n.label}
                </p>
                <p className="hand whitespace-nowrap text-[1.15rem] leading-tight text-dark-fg sm:text-[1.3rem]">
                  {n.text}
                </p>
              </motion.div>
            );
          })}
        </div>

        <Reveal>
          <p className="label folio !text-dark-fg-2 after:!bg-dark-fg/20">When you&rsquo;re back</p>
          <h2 id="dark-h" className="headline mt-6 text-[clamp(2.5rem,1.4rem+3.6vw,4.6rem)]">
            One photo. <em className="serif-em text-safelight">It reads your pencil.</em>
          </h2>
          <p className="mt-6 max-w-lg text-[1.08rem] leading-relaxed text-dark-fg-2">
            Lay the sheet flat and take a picture. Paper Trail finds the four printed corner marks,
            flattens the page and cuts it back into panels. Gemma reads your ticks, your handwriting
            and your answer to the riddle, while a tick-counter checks every box a second time.
          </p>
          <ol className="mono mt-8 grid gap-2 text-[0.8rem] text-dark-fg-2">
            {["Corners found", "Page flattened", "Four panels read", "Ticks double-checked"].map(
              (s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="text-safelight">0{i + 1}</span>
                  <span className="h-px w-6 bg-dark-fg/20" aria-hidden />
                  {s}
                </li>
              ),
            )}
          </ol>
          <div className="mt-12 grid grid-cols-2 gap-8 rounded-[22px] bg-dark-2/70 p-7 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07)]">
            <Board to={2} run={show} label="On screen" />
            <Board to={31} run={show} label="Outside" accent />
            <p className="col-span-2 text-[0.92rem] leading-relaxed text-dark-fg-2">
              Every Field Report ends with this count. The screen should be the small number.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
