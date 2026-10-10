"use client";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/Reveal";

const ink = "#151412";
const riso = "#2B3DD8";

/** 01 — a pin dropped on a street grid, with the walking radius breathing around it. */
function PinArt() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden>
      <g stroke={ink} strokeOpacity=".14" strokeWidth="1">
        {[20, 55, 92, 130].map((y) => (
          <path key={y} d={`M0 ${y} C 60 ${y - 6}, 150 ${y + 8}, 240 ${y - 2}`} fill="none" />
        ))}
        {[30, 82, 140, 196].map((x) => (
          <path key={x} d={`M${x} 0 C ${x + 6} 50, ${x - 8} 100, ${x + 4} 150`} fill="none" />
        ))}
      </g>
      <motion.circle
        cx="120"
        cy="76"
        r="46"
        fill={riso}
        fillOpacity=".07"
        stroke={riso}
        strokeOpacity=".5"
        strokeDasharray="3 4"
        animate={reduce ? undefined : { r: [40, 50, 40] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.g
        initial={reduce ? false : { y: -30, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.3 }}
      >
        <path d="M120 78c-9-12-14-19-14-26a14 14 0 1 1 28 0c0 7-5 14-14 26z" fill={ink} />
        <circle cx="120" cy="52" r="5" fill="#fbfaf6" />
      </motion.g>
      <ellipse cx="120" cy="80" rx="7" ry="2" fill={ink} opacity=".25" />
    </svg>
  );
}

/** 02 — lines of copy arriving, checked one by one. */
function WriteArt() {
  const reduce = useReducedMotion();
  const lines = [160, 120, 172, 96, 140];
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden>
      <rect
        x="40"
        y="14"
        width="160"
        height="122"
        rx="3"
        fill="#fffdf8"
        stroke={ink}
        strokeOpacity=".15"
      />
      <text x="54" y="36" fontFamily="Instrument Serif, serif" fontSize="15" fill={ink}>
        The Golden Hydrant Loop
      </text>
      {lines.map((w, i) => (
        <g key={i}>
          <motion.rect
            x="54"
            y={50 + i * 15}
            height="5"
            rx="2.5"
            fill={ink}
            fillOpacity=".7"
            initial={reduce ? { width: w * 0.75 } : { width: 0 }}
            whileInView={{ width: w * 0.75 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.3 + i * 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            d={`M${186} ${51 + i * 15} l3 3 l6 -6`}
            fill="none"
            stroke={riso}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 1 + i * 0.35 }}
          />
        </g>
      ))}
    </svg>
  );
}

/** 03 — a sheet folding along its long crease, over and over. */
function FoldArt() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden>
      <rect x="40" y="30" width="160" height="90" fill="#fffdf8" stroke={ink} strokeOpacity=".2" />
      {[80, 120, 160].map((x) => (
        <line
          key={x}
          x1={x}
          y1="30"
          x2={x}
          y2="120"
          stroke={ink}
          strokeOpacity=".15"
          strokeDasharray="2 3"
        />
      ))}
      <line
        x1="80"
        y1="75"
        x2="160"
        y2="75"
        stroke={riso}
        strokeWidth="1.6"
        strokeDasharray="4 3"
      />
      <motion.rect
        x="40"
        y="30"
        width="160"
        height="45"
        fill="#ece6d8"
        stroke={ink}
        strokeOpacity=".25"
        style={{ transformOrigin: "120px 75px", transformBox: "view-box" }}
        animate={reduce ? undefined : { scaleY: [1, 1, -1, -1, 1] }}
        transition={{
          duration: 4.2,
          repeat: Infinity,
          times: [0, 0.2, 0.5, 0.8, 1],
          ease: [0.76, 0, 0.24, 1],
        }}
      />
    </svg>
  );
}

/** 04 — a viewfinder snapping onto the four corner marks of a filled-in sheet. */
function PhotoArt() {
  const reduce = useReducedMotion();
  const c = [
    [52, 32],
    [188, 32],
    [52, 118],
    [188, 118],
  ];
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden>
      <rect
        x="48"
        y="28"
        width="144"
        height="94"
        fill="#fffdf8"
        stroke={ink}
        strokeOpacity=".2"
        transform="rotate(-3 120 75)"
      />
      <g transform="rotate(-3 120 75)">
        {c.map(([x, y], i) => (
          <rect key={i} x={x! - 4} y={y! - 4} width="8" height="8" fill={ink} />
        ))}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect
              x={70}
              y={52 + i * 16}
              width="8"
              height="8"
              fill="none"
              stroke={ink}
              strokeOpacity=".5"
            />
            <path
              d={`M71 ${57 + i * 16} l3 3 l6 -8`}
              stroke={riso}
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
            <rect
              x={86}
              y={55 + i * 16}
              width={50 - i * 10}
              height="3"
              rx="1.5"
              fill={ink}
              fillOpacity=".4"
            />
          </g>
        ))}
      </g>
      {c.map(([x, y], i) => {
        const sx = i % 2 ? -1 : 1;
        const sy = i < 2 ? 1 : -1;
        return (
          <motion.path
            key={i}
            d={`M${x! - 10 * sx * -1} ${y! + 14 * sy} v${-14 * sy} h${14 * sx}`}
            fill="none"
            stroke={riso}
            strokeWidth="2"
            initial={reduce ? false : { x: -12 * sx, y: -12 * sy, opacity: 0 }}
            whileInView={{ x: 0, y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.4 + i * 0.08 }}
          />
        );
      })}
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Pick where you start",
    body: "Share your location, search an address, tap the map, or try one of three example parks. Choose 10, 20 or 40 minutes and who’s coming along.",
    art: PinArt,
    wide: false,
  },
  {
    n: "02",
    title: "Gemma writes the pages",
    body: "An open model plans a loop through real places nearby and writes every page for it. Each answer is checked against the map and the page it has to fit. If anything fails, a template built from the same streets takes over, so you always get a trail.",
    art: WriteArt,
    wide: true,
  },
  {
    n: "03",
    title: "Print, cut once, fold",
    body: "Any printer and any paper. Black and white is fine. The fold guide walks you through one cut and six folds.",
    art: FoldArt,
    wide: true,
  },
  {
    n: "04",
    title: "Walk, then one photo",
    body: "Tick, scribble and sketch in pencil. Back home, one photo of the sheet gets you a Field Report and a stamp in your Trail Book.",
    art: PhotoArt,
    wide: false,
  },
];

export function How() {
  return (
    <section
      id="how"
      aria-labelledby="how-h"
      className="relative mx-auto max-w-7xl px-[var(--gutter)] py-28 sm:py-36"
    >
      <Reveal className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-end">
        <div>
          <p className="label folio">How it works</p>
          <h2 id="how-h" className="headline mt-6 text-[clamp(2.5rem,1.4rem+3.6vw,4.8rem)]">
            From your street to your pocket{" "}
            <em className="serif-em text-riso">in about a minute.</em>
          </h2>
        </div>
        <p className="lede max-w-md md:justify-self-end">
          The screen part is short on purpose. Four steps, and only the first two happen on a
          screen.
        </p>
      </Reveal>
      <ol className="mt-16 grid gap-4 md:grid-cols-5">
        {STEPS.map(({ n, title, body, art: Art, wide }, i) => (
          <Reveal
            as="li"
            key={n}
            delay={(i % 2) * 0.08}
            className={`card group flex flex-col overflow-hidden p-7 transition-transform duration-700 ease-[var(--ease-out-expo)] hover:-translate-y-1 sm:p-8 ${wide ? "md:col-span-3" : "md:col-span-2"}`}
          >
            <div className="flex items-center justify-between">
              <span className="mono text-[0.78rem] text-riso">{n}</span>
              <span className="label">{i < 2 ? "on screen" : "on paper"}</span>
            </div>
            <div className="mt-4 h-40 rounded-2xl bg-bone/70 shadow-[inset_0_0_0_1px_var(--color-line)] sm:h-44">
              <Art />
            </div>
            <h3 className="title mt-7 text-[1.9rem]">{title}</h3>
            <p className="mt-2 max-w-prose leading-relaxed text-ink-2">{body}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
