"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowRight } from "lucide-react";
import { Sheet } from "@/lib/zine/Sheet";
import { demoZine } from "@/lib/demo/demoZine";
import { ModelBadge } from "@/components/ModelBadge";

const StudioScene = dynamic(() => import("./StudioScene"), { ssr: false });

/** Without WebGL (or if it crashes) the printed sheet sits on the page as a still. */
class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function hasWebGL(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

const ramp = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
const EASE = [0.16, 1, 0.3, 1] as const;

const CHAPTERS = [
  {
    at: [0.12, 0.32],
    n: "i",
    title: "One sheet of paper.",
    body: "Every trail is a single page from your own printer, laid out as eight small pages around one cut.",
  },
  {
    at: [0.36, 0.6],
    n: "ii",
    title: "Drawn from your actual streets.",
    body: "The map, the stops and the things to spot come from OpenStreetMap around where you start. Nothing is made up.",
  },
  {
    at: [0.64, 0.84],
    n: "iii",
    title: "One cut, a few folds.",
    body: "Crease it along the lines and it becomes a booklet that fits a back pocket. No glue, no stapler.",
  },
  {
    at: [0.87, 1],
    n: "iv",
    title: "Then the phone stays behind.",
    body: "Everything you need for the next half hour is on paper. No battery, no signal, no pings.",
  },
] as const;

function Chapter({ p, c }: { p: MotionValue<number>; c: (typeof CHAPTERS)[number] }) {
  const [a, b] = c.at;
  const last = b >= 1;
  const opacity = useTransform(p, (v) =>
    Math.min(ramp(v, a, a + 0.035), last ? 1 : 1 - ramp(v, b - 0.035, b)),
  );
  const y = useTransform(
    p,
    (v) => 28 * (1 - ramp(v, a, a + 0.05)) - (last ? 0 : 18 * ramp(v, b - 0.04, b)),
  );
  const clip = useTransform(p, (v) => `inset(0 ${100 - 100 * ramp(v, a, a + 0.06)}% 0 0)`);
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-x-0 bottom-0">
      <div className="flex items-center gap-4">
        <span className="font-serif text-[2.4rem] italic leading-none text-riso">{c.n}.</span>
        <motion.span style={{ clipPath: clip }} className="h-px flex-1 bg-ink/25" aria-hidden />
        <span className="label">{CHAPTERS.findIndex((x) => x.n === c.n) + 1} / 4</span>
      </div>
      <h3 className="headline mt-5 text-[clamp(2.1rem,1.3rem+2.6vw,3.6rem)]">{c.title}</h3>
      <p className="lede mt-4 max-w-md">{c.body}</p>
    </motion.div>
  );
}

const WORDS = ["The", "walk", "app", "that"];

export function Studio() {
  const ref = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [gl, setGl] = useState<boolean | null>(null);
  const reduce = useReducedMotion();
  const data = useMemo(() => demoZine(), []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => (progress.current = v));
  const heroOpacity = useTransform(scrollYProgress, (v) => 1 - ramp(v, 0.015, 0.075));
  const heroY = useTransform(scrollYProgress, (v) => -80 * ramp(v, 0, 0.09));
  const heroEvents = useTransform(scrollYProgress, (v) => (v < 0.05 ? "auto" : "none"));
  const cue = useTransform(scrollYProgress, (v) => 1 - ramp(v, 0, 0.03));
  const veil = useTransform(scrollYProgress, (v) => ramp(v, 0.08, 0.16));
  const bar = useTransform(scrollYProgress, (v) => `${v * 100}%`);
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => setGl(hasWebGL()), []);

  // Stop drawing WebGL frames once the studio has scrolled away.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(!!e?.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const still = (
    <div className="absolute inset-0 flex items-start justify-center px-6 pt-[16svh] md:items-center md:justify-end md:pr-[5vw] md:pt-0">
      <div className="paper w-full max-w-[600px] overflow-hidden [transform:perspective(1800px)_rotateX(14deg)_rotateZ(-3deg)]">
        <Sheet
          data={data}
          paperBg={false}
          className="sheet-svg"
          title="An example Paper Trail sheet"
        />
      </div>
    </div>
  );

  return (
    <section
      ref={ref}
      id="unfold"
      aria-label="Paper Trail, unfolded"
      className="relative h-[440vh]"
    >
      {/* The sheet the 3D paper is printed from (also exactly what you'd print). */}
      <div
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 w-[1100px] opacity-0"
      >
        <Sheet data={data} id="studio-sheet" paperBg={false} />
      </div>

      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Daylight from the top left, falling onto the desk. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_22%_8%,rgba(255,255,255,0.75),transparent_65%),radial-gradient(60%_55%_at_80%_92%,rgba(204,192,168,0.35),transparent_70%)]"
        />
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{
            opacity: ready || gl === false ? 1 : 0,
            scale: ready || gl === false ? 1 : 1.02,
          }}
          transition={{ duration: 1.8, ease: EASE }}
        >
          {gl === false
            ? still
            : gl && (
                <SceneBoundary fallback={still}>
                  <StudioScene
                    progress={progress}
                    sheetId="studio-sheet"
                    onReady={onReady}
                    active={active}
                  />
                </SceneBoundary>
              )}
        </motion.div>

        {/* Hero */}
        <motion.div
          style={
            reduce
              ? { opacity: heroOpacity, pointerEvents: heroEvents }
              : { opacity: heroOpacity, y: heroY, pointerEvents: heroEvents }
          }
          className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-[var(--gutter)] pb-[9svh] md:justify-center md:pb-0"
        >
          <div className="max-w-[40rem]">
            <motion.p
              className="label flex items-center gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: EASE }}
            >
              <span className="inline-block h-px w-8 bg-ink/40" aria-hidden />
              Printed walks for real streets
            </motion.p>
            <h1 className="display mt-6 text-[clamp(3.3rem,1.4rem+7.4vw,8.4rem)]">
              <span className="block overflow-hidden pb-[0.06em]">
                {WORDS.map((w, i) => (
                  <motion.span
                    key={w}
                    className="inline-block pr-[0.2em]"
                    initial={reduce ? false : { y: "105%", rotate: 4 }}
                    animate={{ y: "0%", rotate: 0 }}
                    transition={{ duration: 1.2, delay: 0.15 + i * 0.07, ease: EASE }}
                  >
                    {w}
                  </motion.span>
                ))}
              </span>
              <span className="block overflow-hidden pb-[0.12em]">
                <motion.em
                  className="inline-block text-riso"
                  initial={reduce ? false : { y: "105%", rotate: 4 }}
                  animate={{ y: "0%", rotate: 0 }}
                  transition={{ duration: 1.3, delay: 0.46, ease: EASE }}
                >
                  stays home.
                </motion.em>
              </span>
            </h1>
            <motion.p
              className="lede mt-6 max-w-[33rem]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.7, ease: EASE }}
            >
              Paper Trail folds the streets around you into an eight-page paper zine: a hand-drawn
              map, things to spot, a riddle and a box to sketch in. Print it, leave your phone, go.
              When you&rsquo;re back, one photo and Gemma reads your pencil.
            </motion.p>
            <motion.div
              className="mt-9 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, delay: 0.85, ease: EASE }}
            >
              <Link href="/new" className="btn btn-riso btn-lg">
                Make my trail
                <span className="knob" aria-hidden>
                  <ArrowRight size={18} />
                </span>
              </Link>
              <a href="#pages" className="btn btn-lg">
                See inside
              </a>
            </motion.div>
            <motion.div
              className="mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1.1 }}
            >
              <ModelBadge />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          style={{ opacity: cue }}
          className="pointer-events-none absolute inset-x-0 bottom-7 z-10 hidden justify-center md:flex"
        >
          <span className="label flex flex-col items-center gap-3">
            Scroll to unfold
            <span className="relative block h-10 w-px overflow-hidden bg-ink/15" aria-hidden>
              <span className="absolute inset-x-0 top-0 h-1/2 animate-[cue_1.8s_var(--ease-in-out-quart)_infinite] bg-ink" />
            </span>
          </span>
        </motion.div>

        {/* A soft wash so chapter text stays readable over the paper. */}
        <motion.div
          aria-hidden
          style={{ opacity: veil }}
          className="pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(90deg,rgba(241,237,228,0.95)_0%,rgba(241,237,228,0.7)_30%,transparent_50%)] max-md:bg-[linear-gradient(0deg,rgba(241,237,228,0.98)_0%,rgba(241,237,228,0.85)_36%,transparent_56%)]"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-[8svh] z-10 mx-auto max-w-7xl px-[var(--gutter)] md:bottom-auto md:top-1/2 md:-translate-y-1/2">
          <div className="relative h-64 max-w-[30rem] md:h-80">
            {CHAPTERS.map((c) => (
              <Chapter key={c.n} p={scrollYProgress} c={c} />
            ))}
          </div>
        </div>

        {/* Reading progress for the story, like a fold line being scored. */}
        <div className="absolute inset-x-0 bottom-0 z-10 h-[2px] bg-ink/5" aria-hidden>
          <motion.div className="h-full bg-riso" style={{ width: bar }} />
        </div>
      </div>
    </section>
  );
}
