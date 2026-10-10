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
import { ArrowDown, ArrowRight } from "lucide-react";
import { Sheet } from "@/lib/zine/Sheet";
import { demoZine } from "@/lib/demo/demoZine";
import { ModelBadge } from "@/components/ModelBadge";

const ZineScene = dynamic(() => import("./ZineScene"), { ssr: false });

/** If WebGL is missing or crashes, show the printed sheet as a still instead. */
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

const STEPS = [
  {
    at: [0.12, 0.3],
    n: "01",
    title: "Your streets, on one sheet.",
    body: "Paper Trail reads the real map around you — parks, benches, murals, the old post box — and lays it out on a single page.",
  },
  {
    at: [0.34, 0.6],
    n: "02",
    title: "Eight small pages.",
    body: "A hand-drawn map, the route, things to spot, a sound to listen for, a riddle and a box to draw in.",
  },
  {
    at: [0.63, 0.82],
    n: "03",
    title: "One cut. A few folds.",
    body: "Print it at home on any paper. It folds into a booklet that fits in your pocket.",
  },
  {
    at: [0.85, 1],
    n: "04",
    title: "Then leave the phone.",
    body: "Everything you need is on the paper. Your phone can wait on the table.",
  },
] as const;

function Step({ p, step }: { p: MotionValue<number>; step: (typeof STEPS)[number] }) {
  const [a, b] = step.at;
  const last = b >= 1;
  // Function transforms stay on the JS path: the native ScrollTimeline path
  // mis-maps ranges for elements inside a sticky container.
  const opacity = useTransform(p, (v) =>
    Math.min(ramp(v, a, a + 0.04), last ? 1 : 1 - ramp(v, b - 0.04, b)),
  );
  const y = useTransform(
    p,
    (v) => 24 * (1 - ramp(v, a, a + 0.05)) - (last ? 0 : 16 * ramp(v, b - 0.04, b)),
  );
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-x-0 bottom-0">
      <p className="eyebrow mb-3">
        <span className="text-grass">{step.n}</span> / 04
      </p>
      <h3 className="h2 text-[clamp(1.9rem,1.2rem+2.4vw,3.2rem)]">{step.title}</h3>
      <p className="lede mt-3 max-w-md">{step.body}</p>
    </motion.div>
  );
}

export function Story() {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const reduce = useReducedMotion();
  const data = useMemo(() => demoZine(), []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => (progress.current = v));
  const heroOpacity = useTransform(scrollYProgress, (v) => 1 - ramp(v, 0, 0.07));
  const heroY = useTransform(scrollYProgress, (v) => -60 * ramp(v, 0, 0.08));
  const heroEvents = useTransform(scrollYProgress, (v) => (v < 0.05 ? "auto" : "none"));
  const shade = useTransform(scrollYProgress, (v) => ramp(v, 0.08, 0.16));
  const cueOpacity = useTransform(scrollYProgress, (v) => 1 - ramp(v, 0, 0.03));
  const onReady = useCallback(() => setReady(true), []);
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  const still = (
    <div className="absolute inset-0 flex items-start justify-center px-6 pt-[14svh] md:items-center md:justify-end md:pr-[6vw] md:pt-0">
      <div className="paper w-full max-w-[560px] overflow-hidden [transform:perspective(1600px)_rotateX(18deg)_rotateZ(-4deg)]">
        <Sheet
          data={data}
          paperBg={false}
          className="sheet-svg"
          title="An example Paper Trail sheet"
        />
      </div>
    </div>
  );

  // Stop rendering WebGL once the story has scrolled away.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(!!e?.isIntersecting), {
      rootMargin: "100px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="how" aria-label="How Paper Trail works" className="relative h-[420vh]">
      {/* The sheet the 3D model is printed from (also what you'd print). */}
      <div
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 w-[1100px] opacity-0"
      >
        <Sheet data={data} id="landing-sheet" paperBg={false} />
      </div>

      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: ready || gl === false ? 1 : 0 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {gl === false
            ? still
            : gl && (
                <SceneBoundary fallback={still}>
                  <ZineScene
                    progress={progress}
                    sheetId="landing-sheet"
                    onReady={onReady}
                    active={active}
                  />
                </SceneBoundary>
              )}
        </motion.div>
        {!ready && (
          <div
            className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_40%,rgba(244,194,122,0.08),transparent)]"
            aria-hidden
          />
        )}

        {/* Hero copy */}
        <motion.div
          style={
            reduce
              ? { opacity: heroOpacity, pointerEvents: heroEvents }
              : { opacity: heroOpacity, y: heroY, pointerEvents: heroEvents }
          }
          className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-5 pb-[18svh] sm:px-8 md:justify-center md:pb-0"
        >
          <div className="max-w-[34rem]">
            <motion.p
              className="eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1 }}
            >
              A walk you print at home
            </motion.p>
            <h1 className="display mt-5 text-[clamp(3rem,1.6rem+5.6vw,6.4rem)]">
              {["Leave", "your", "phone"].map((w, i) => (
                <motion.span
                  key={w}
                  className="inline-block pr-[0.22em]"
                  initial={{ opacity: 0, y: "0.4em", filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 1.1, delay: 0.15 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  {w}
                </motion.span>
              ))}
              <br />
              <motion.em
                className="inline-block text-grass"
                initial={{ opacity: 0, y: "0.4em", filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 1.2, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
              >
                at home.
              </motion.em>
            </h1>
            <motion.p
              className="lede mt-6 max-w-[30rem]"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.6 }}
            >
              Paper Trail turns the streets around you into a little paper booklet for a short walk.
              Print it, go outside, and take one photo when you&rsquo;re back.
            </motion.p>
            <motion.div
              className="mt-9 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.75 }}
            >
              <Link href="/new" className="btn btn-primary btn-lg">
                Make my trail <ArrowRight size={18} className="arrow" />
              </Link>
              <a href="#pages" className="btn btn-lg">
                See what&rsquo;s inside
              </a>
            </motion.div>
            <motion.div
              className="mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
            >
              <ModelBadge />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          style={{ opacity: cueOpacity }}
          className="pointer-events-none absolute inset-x-0 bottom-6 z-10 hidden justify-center md:flex"
        >
          <span className="mono flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-fg-3">
            Scroll to unfold <ArrowDown size={13} className="animate-bounce" />
          </span>
        </motion.div>

        {/* A soft shade so captions stay readable over the paper. */}
        <motion.div
          aria-hidden
          style={{ opacity: shade }}
          className="pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(90deg,rgba(10,10,8,0.92)_0%,rgba(10,10,8,0.55)_30%,transparent_52%),linear-gradient(0deg,rgba(10,10,8,0.85)_0%,transparent_38%)] max-md:bg-[linear-gradient(0deg,rgba(10,10,8,0.95)_0%,rgba(10,10,8,0.6)_34%,transparent_55%)]"
        />

        {/* Story captions */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[7svh] z-10 mx-auto max-w-6xl px-5 sm:px-8">
          <div className="relative h-56 max-w-xl">
            {STEPS.map((s) => (
              <Step key={s.n} p={scrollYProgress} step={s} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
