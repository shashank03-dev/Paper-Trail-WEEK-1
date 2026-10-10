"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/Reveal";

const NOTES = [
  { x: "62%", y: "17%", label: "I-Spy", text: "7 of 9 ticked" },
  { x: "8%", y: "26%", label: "Listen", text: "“pigeons arguing”" },
  { x: "4%", y: "70%", label: "Riddle", text: "drinking fountain ✓" },
  { x: "38%", y: "80%", label: "Sketch", text: "a tree, waving" },
];

function Counter({ to, suffix, run }: { to: number; suffix: string; run: boolean }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const c = animate(0, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (x) => setV(Math.round(x)),
    });
    return () => c.stop();
  }, [run, to]);
  return (
    <>
      {v}
      <span className="text-[0.55em] text-fg-3">{suffix}</span>
    </>
  );
}

export function Return() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();
  return (
    <section
      className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36"
      aria-labelledby="return-h"
    >
      <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div ref={ref} className="relative">
          <div className="paper relative overflow-hidden !rounded-[10px] p-0">
            <img
              src="/samples/filled-sheet.jpg"
              alt="A filled-in Paper Trail sheet, photographed on a table"
              className="block w-full"
              loading="lazy"
            />
            {inView && !reduce && (
              <div
                className="scan pointer-events-none absolute inset-0"
                style={{ animationIterationCount: 2 }}
              />
            )}
          </div>
          {NOTES.map((n, i) => (
            <motion.div
              key={n.label}
              className="glass absolute rounded-2xl px-3.5 py-2.5"
              style={{ left: n.x, top: n.y }}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.8 + i * 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mono text-[0.62rem] uppercase tracking-[0.14em] text-grass">
                {n.label}
              </p>
              <p className="hand text-[1.35rem] leading-none text-fg">{n.text}</p>
            </motion.div>
          ))}
        </div>
        <Reveal>
          <p className="eyebrow">When you&rsquo;re back</p>
          <h2 id="return-h" className="h2 mt-4 text-[clamp(2.3rem,1.4rem+3vw,4rem)]">
            One photo. <em className="serif-italic text-fg-2">It reads your pencil.</em>
          </h2>
          <p className="lede mt-5">
            Lay the sheet flat and take a picture. Paper Trail finds the corners, straightens the
            page and reads your ticks, your handwriting and your answer to the riddle. It even
            describes your drawing — kindly.
          </p>
          <div className="panel mt-10 grid grid-cols-2 gap-6 p-6">
            <div>
              <p className="eyebrow">Screen</p>
              <p className="h2 mt-2 text-5xl">
                <Counter to={2} suffix=" min" run={inView} />
              </p>
            </div>
            <div>
              <p className="eyebrow">Outside</p>
              <p className="h2 mt-2 text-5xl text-grass">
                <Counter to={31} suffix=" min" run={inView} />
              </p>
            </div>
            <div className="col-span-2">
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="bg-fg-2"
                  initial={{ width: 0 }}
                  animate={inView ? { width: "6%" } : {}}
                  transition={{ duration: 1.4, delay: 0.3 }}
                />
                <motion.div
                  className="bg-grass"
                  initial={{ width: 0 }}
                  animate={inView ? { width: "94%" } : {}}
                  transition={{ duration: 1.6, delay: 0.4 }}
                />
              </div>
              <p className="mt-3 text-sm text-fg-2">
                Every trail ends with this. The screen should be the smallest part.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
