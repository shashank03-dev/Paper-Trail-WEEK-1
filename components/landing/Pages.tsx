"use client";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PageSvg } from "@/lib/zine/PageSvg";
import { demoZine } from "@/lib/demo/demoZine";
import type { PageNo } from "@/lib/zine/layout";
import { Reveal } from "@/components/Reveal";

const PAGES: { n: PageNo; title: string; body: string }[] = [
  { n: 1, title: "Cover", body: "A title written for your street, the weather, your name." },
  { n: 2, title: "The map", body: "Your real streets, drawn by hand. The loop, the stops, north." },
  { n: 3, title: "The route", body: "Directions by landmark, not by street number." },
  { n: 4, title: "I-Spy", body: "Things that are really there. Tick them as you go." },
  { n: 5, title: "Listen", body: "Stand still for a minute. Write down what you hear." },
  { n: 6, title: "The riddle", body: "The answer is somewhere on your loop." },
  { n: 7, title: "Sketch", body: "A box and a prompt. Nobody grades the drawing." },
  { n: 8, title: "Bring me home", body: "Snap one photo of the sheet when you're back." },
];

export function Pages() {
  const data = useMemo(() => demoZine(), []);
  const reduce = useReducedMotion();
  return (
    <section
      id="pages"
      className="relative mx-auto max-w-6xl px-5 py-28 sm:px-8 sm:py-36"
      aria-labelledby="pages-h"
    >
      <Reveal className="max-w-2xl">
        <p className="eyebrow">What&rsquo;s inside</p>
        <h2 id="pages-h" className="h2 mt-4 text-[clamp(2.3rem,1.4rem+3vw,4rem)]">
          One sheet. <em className="serif-italic text-fg-2">Eight pages.</em> A whole walk.
        </h2>
        <p className="lede mt-5">
          Every trail is written for the place you start from, so no two are the same. Here&rsquo;s
          one from Dolores Park in San Francisco.
        </p>
      </Reveal>
      <ul className="mt-16 grid grid-cols-2 gap-x-5 gap-y-12 sm:gap-x-8 md:grid-cols-4">
        {PAGES.map((p, i) => (
          <Reveal as="li" key={p.n} delay={(i % 4) * 0.07} className="group">
            <motion.div
              whileHover={reduce ? undefined : { y: -8, rotateX: 6, rotateY: i % 2 ? -6 : 6 }}
              transition={{ type: "spring", stiffness: 220, damping: 20 }}
              style={{ transformPerspective: 900 }}
              className="paper overflow-hidden !rounded-[3px]"
            >
              <PageSvg data={data} page={p.n} className="block h-auto w-full" />
            </motion.div>
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="mono text-[0.7rem] text-grass">{String(p.n).padStart(2, "0")}</span>
              <h3 className="h3 text-lg">{p.title}</h3>
            </div>
            <p className="mt-1 text-[0.92rem] leading-relaxed text-fg-2">{p.body}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
