"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { PageSvg } from "@/lib/zine/PageSvg";
import { demoZine } from "@/lib/demo/demoZine";
import type { PageNo } from "@/lib/zine/layout";
import type { ZineData } from "@/lib/zine/primitives";

const PAGES: { n: PageNo; title: string; body: string }[] = [
  {
    n: 1,
    title: "Cover",
    body: "A title written for your street, the day’s weather and your name.",
  },
  {
    n: 2,
    title: "The map",
    body: "Your real streets, drawn by hand. The loop, the stops and which way is north.",
  },
  {
    n: 3,
    title: "The route",
    body: "Directions by landmark: left at the mural, not left on 18th Street.",
  },
  {
    n: 4,
    title: "I-Spy",
    body: "Things that are really there, each worth points. Tick them as you pass.",
  },
  {
    n: 5,
    title: "Listen",
    body: "One stop where you stand still for a minute and write down what you hear.",
  },
  {
    n: 6,
    title: "The riddle",
    body: "The answer is somewhere on your loop. You’ll know it when you see it.",
  },
  {
    n: 7,
    title: "Sketch",
    body: "A box and a prompt. Nobody grades the drawing, though Gemma will describe it.",
  },
  {
    n: 8,
    title: "Back cover",
    body: "How to bring it home, and a note on who wrote the words and where.",
  },
];
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];

/** A page that leans toward the pointer, like a card picked up off the table. */
function PageCard({ data, p, i }: { data: ZineData; p: (typeof PAGES)[number]; i: number }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [7, -7]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-9, 9]), { stiffness: 180, damping: 18 });
  const glare = useTransform(
    [mx, my],
    ([x = 0, y = 0]: number[]) =>
      `radial-gradient(60% 50% at ${50 + x * 80}% ${50 + y * 80}%, rgba(255,255,255,0.45), transparent 70%)`,
  );
  const lift = useSpring(0, { stiffness: 200, damping: 20 });
  return (
    <li className="group w-[min(74vw,19rem)] shrink-0 md:w-[clamp(15rem,19vw,19.5rem)]">
      <div
        className="[perspective:1000px]"
        onPointerMove={(e) => {
          if (reduce || e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width - 0.5);
          my.set((e.clientY - r.top) / r.height - 0.5);
          lift.set(-10);
        }}
        onPointerLeave={() => {
          mx.set(0);
          my.set(0);
          lift.set(0);
        }}
      >
        <motion.div
          style={{ rotateX: rx, rotateY: ry, y: lift, rotate: i % 2 ? 0.8 : -0.8 }}
          className="paper relative overflow-hidden !rounded-[4px]"
        >
          <PageSvg data={data} page={p.n} className="block h-auto w-full" />
          <motion.div
            aria-hidden
            style={{ background: glare }}
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        </motion.div>
      </div>
      <div className="mt-6 flex items-baseline gap-3">
        <span className="font-serif text-2xl italic text-riso">{ROMAN[i]}.</span>
        <h3 className="title text-[1.65rem]">{p.title}</h3>
      </div>
      <p className="mt-2 text-[0.96rem] leading-relaxed text-ink-2">{p.body}</p>
    </li>
  );
}

export function Pages() {
  const data = useMemo(() => demoZine(), []);
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const [desktop, setDesktop] = useState(false);
  const [distance, setDistance] = useState(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const x = useTransform(
    scrollYProgress,
    (v) => -distance * Math.min(1, Math.max(0, (v - 0.04) / 0.92)),
  );
  const meter = useTransform(scrollYProgress, (v) => `${Math.min(100, v * 100)}%`);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    const measure = () => {
      setDesktop(m.matches);
      const el = track.current;
      if (el) setDistance(Math.max(0, el.scrollWidth - window.innerWidth));
    };
    measure();
    m.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      m.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section
      ref={section}
      id="pages"
      aria-labelledby="pages-h"
      className={`relative ${desktop ? "h-[340vh]" : "py-24"}`}
    >
      <div
        className={
          desktop ? "sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden" : ""
        }
      >
        <div className="mx-auto w-full max-w-7xl px-[var(--gutter)]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="label folio">What&rsquo;s inside</p>
              <h2 id="pages-h" className="headline mt-6 text-[clamp(2.5rem,1.4rem+3.6vw,4.8rem)]">
                Eight small pages. <em className="serif-em text-ink-3">One whole walk.</em>
              </h2>
            </div>
            <p className="lede max-w-sm">
              Every trail is written for the place it starts, so no two are alike. This one begins
              at Dolores Park, San Francisco.
            </p>
          </div>
        </div>
        <motion.ul
          ref={track}
          // On phones the rail scrolls sideways, so it has to be reachable by keyboard.
          tabIndex={desktop ? undefined : 0}
          style={desktop ? { x } : undefined}
          className={`mt-14 flex gap-8 ${desktop ? "w-max pl-[max(var(--gutter),calc((100vw-80rem)/2+var(--gutter)))] pr-[var(--gutter)]" : "rail pb-4"}`}
          aria-label="The eight pages of an example trail"
        >
          {PAGES.map((p, i) => (
            <PageCard key={p.n} data={data} p={p} i={i} />
          ))}
        </motion.ul>
        {desktop && (
          <div
            className="mx-auto mt-12 flex w-full max-w-7xl items-center gap-4 px-[var(--gutter)]"
            aria-hidden
          >
            <span className="label">i</span>
            <span className="relative h-px flex-1 bg-ink/15">
              <motion.span className="absolute inset-y-0 left-0 bg-ink" style={{ width: meter }} />
            </span>
            <span className="label">viii</span>
          </div>
        )}
      </div>
    </section>
  );
}
