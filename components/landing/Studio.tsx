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
import { motion } from "motion/react";
import { createTimeline } from "animejs";
import { ArrowRight } from "lucide-react";
import { Sheet } from "@/lib/zine/Sheet";
import { demoZine } from "@/lib/demo/demoZine";
import { ModelBadge } from "@/components/ModelBadge";
import { deviceTier, type Tier } from "@/lib/client/device";
import type { Rig } from "./StudioScene";
import { CAMERA_FOV, CAMERA_Z, DESK_Z, SHEET_H, SHEET_W } from "./foldSheet";

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

const EASE = [0.16, 1, 0.3, 1] as const;

const CHAPTERS = [
  {
    n: "i",
    title: "One sheet of paper.",
    body: "Every trail is a single page from your own printer, laid out as eight small pages around one cut.",
  },
  {
    n: "ii",
    title: "Drawn from your actual streets.",
    body: "The map, the stops and the things to spot come from OpenStreetMap around where you start. Nothing is made up.",
  },
  {
    n: "iii",
    title: "One cut, a few folds.",
    body: "Crease it along the lines and it becomes a booklet that fits a back pocket. No glue, no stapler.",
  },
  {
    n: "iv",
    title: "Then the phone stays behind.",
    body: "Everything you need for the next half hour is on paper. No battery, no signal, no pings.",
  },
] as const;

/* ------------------------------------------------------------------ */
/*  Poses. Positions are in the scene's units (100 mm); the timeline   */
/*  below moves the paper between them while the folds open & close.  */
/* ------------------------------------------------------------------ */

type Pose = Pick<Rig, "x" | "y" | "z" | "s" | "rx" | "ry" | "rz"> & { fx?: number; fy?: number };
interface Poses {
  rest: Pose;
  lift: Pose;
  flat: Pose;
  drift: Pose;
  map: Pose;
  upright: Pose;
  land: Pose;
}

// Page 2 (the map) is the top-right panel, printed upside down. The sheet turns
// half a revolution about the map itself, so the map holds still at `at`
// while the rest of the sheet swings round it.
const mapPose = (s: number, at: [number, number]): Pose => ({
  x: at[0],
  y: at[1],
  z: 0.5,
  s,
  rx: -0.02,
  ry: 0.02,
  rz: Math.PI - 0.02,
  fx: (SHEET_W * 3) / 8,
  fy: SHEET_H / 4,
});

const DESKTOP: Poses = {
  rest: { x: 1.72, y: 0.05, z: 0.02, s: 1.62, rx: 0.06, ry: 0.04, rz: -0.16 },
  lift: { x: 1.45, y: -0.02, z: 0.55, s: 1.5, rx: -0.14, ry: -0.32, rz: -0.07 },
  flat: { x: 1.18, y: 0.02, z: 0.42, s: 1.02, rx: -0.08, ry: -0.06, rz: 0.015 },
  drift: { x: 1.2, y: 0.02, z: 0.45, s: 1.04, rx: -0.04, ry: 0.05, rz: 0.01 },
  map: mapPose(1.45, [1.12, -0.04]),
  upright: { x: 1.45, y: 0.0, z: 0.6, s: 1.5, rx: -0.1, ry: 0.42, rz: 0.06 },
  land: { x: 1.6, y: -0.12, z: 0.03, s: 1.45, rx: 0.04, ry: 0.0, rz: 0.16 },
};
const MOBILE: Poses = {
  rest: { x: -0.22, y: 1.2, z: 0.02, s: 0.74, rx: 0.05, ry: 0, rz: -0.14 },
  lift: { x: 0, y: 1.0, z: 0.4, s: 0.8, rx: -0.12, ry: -0.3, rz: -0.06 },
  flat: { x: 0, y: 0.86, z: 0.3, s: 0.55, rx: -0.06, ry: 0, rz: 0 },
  drift: { x: 0, y: 0.88, z: 0.32, s: 0.56, rx: -0.03, ry: 0.04, rz: 0.01 },
  map: mapPose(1.0, [0, 0.82]),
  upright: { x: 0, y: 0.82, z: 0.45, s: 1.0, rx: -0.1, ry: 0.4, rz: 0.05 },
  land: { x: -0.2, y: 1.12, z: 0.03, s: 0.78, rx: 0.04, ry: 0, rz: 0.12 },
};

const folded = { top: 1, a: 1, b: 1, c: 1 };
type Pen = Pick<Rig, "penX" | "penY" | "penR" | "penS">;
const DESKTOP_PEN: Pen = { penX: 1.55, penY: -1.38, penR: 0.14, penS: 1 };
const initialRig = (p: Poses, pen: Pen): Rig => ({
  fx: 0,
  fy: 0,
  ...p.rest,
  ...folded,
  away: 0,
  ...pen,
});

/**
 * Phones vary a lot in height, so the resting booklet and pencil are fitted
 * into the band actually left free between the nav and the hero copy, measured
 * on the page, instead of fixed numbers that overlap the headline on short screens.
 */
function fitPhone(copyTop: number): { poses: Poses; pen: Pen } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const worldPerPx =
    (2 * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180) * (CAMERA_Z - (DESK_Z + 0.05))) / vh;
  const navBottom = 72;
  const band = copyTop - navBottom - 14;
  if (band < 110) {
    // No room above the copy on this screen: the booklet waits just above the
    // frame and drops in as the story starts; the pencil sits this one out.
    const above = { ...MOBILE.rest, y: (vh / 2 + 200) * worldPerPx };
    return {
      poses: { ...MOBILE, rest: above },
      pen: { penX: 0, penY: (vh / 2 + 300) * worldPerPx, penR: 1.05, penS: 0.001 },
    };
  }
  const centreY = (vh / 2 - (navBottom + band / 2 + 4)) * worldPerPx;
  const s = (Math.min(band * 0.86, 250) * worldPerPx) / (SHEET_H / 2);
  const x = (vw * 0.38 - vw / 2) * worldPerPx;
  const rest = { x, y: centreY, z: 0.02, s, rx: 0.05, ry: 0, rz: -0.14 };
  const penLen = (band * 0.92 * worldPerPx) / Math.sin(1.05);
  return {
    poses: { ...MOBILE, rest, land: { ...rest, z: 0.03, rz: 0.12 } },
    pen: {
      penX: (vw * 0.74 - vw / 2) * worldPerPx,
      penY: centreY,
      penR: 1.05,
      penS: Math.min(0.5, penLen / 1.85),
    },
  };
}

/**
 * One anime.js timeline for the whole story. Time runs 0 → 1000 across the
 * section's scroll; everything that moves in the hero (paper, folds, pencil,
 * captions, the hero copy itself) is a track on it, so nothing can drift out
 * of step. The playhead is driven by `useScrollScrub` below.
 */
function choreograph(
  rig: Rig,
  p: Poses,
  el: {
    hero: HTMLElement;
    cue: HTMLElement;
    veil: HTMLElement;
    bar: HTMLElement;
    chapters: HTMLElement[];
    /** The flat fallback sheet on a phone: it waits behind the hero copy, then fades in. */
    still?: HTMLElement | null;
  },
) {
  const tl = createTimeline({ defaults: { ease: "inOutSine" }, autoplay: false });
  const pose = (to: Pose, at: number, dur: number, ease = "inOutCubic") =>
    tl.add(rig, { fx: 0, fy: 0, ...to, duration: dur, ease }, at);
  const fold = (key: "top" | "a" | "b" | "c", to: number, at: number, dur: number, ease: string) =>
    tl.add(rig, { [key]: to, duration: dur, ease }, at);
  const caption = (i: number, inAt: number, outAt?: number) => {
    const c = el.chapters[i]!;
    tl.add(c, { opacity: [0, 1], translateY: [28, 0], duration: 40, ease: "outCubic" }, inAt);
    if (outAt !== undefined)
      tl.add(c, { opacity: 0, translateY: -18, duration: 30, ease: "inCubic" }, outAt);
  };

  // The hero copy steps aside and the paper lifts off the desk; the pencil rolls away.
  tl.add(
    el.hero,
    {
      opacity: [1, 0],
      translateY: [0, -80],
      duration: 70,
      ease: "inQuad",
      // Faded hero links must not catch clicks meant for the story underneath.
      onUpdate: () => {
        el.hero.style.pointerEvents = Number(el.hero.style.opacity || 1) < 0.3 ? "none" : "";
      },
    },
    10,
  );
  tl.add(el.cue, { opacity: [1, 0], duration: 30 }, 0);
  if (el.still) tl.add(el.still, { opacity: [0, 1], duration: 70, ease: "outCubic" }, 60);
  tl.add(el.veil, { opacity: [0, 1], duration: 80 }, 120);
  tl.add(rig, { away: 1, duration: 150, ease: "inOutQuad" }, 40);
  pose(p.lift, 50, 110, "outCubic");

  // Unfold: the concertina opens from the outer flap in, each crease a beat
  // after the last, then the long crease lets the top row swing up.
  fold("c", 0, 135, 115, "inOutSine");
  fold("b", 0, 160, 115, "inOutSine");
  fold("a", 0, 185, 115, "inOutSine");
  fold("top", 0, 280, 95, "inOutQuad");
  pose(p.flat, 160, 220, "inOutSine");
  caption(0, 340, 480);
  pose(p.drift, 380, 140, "inOutSine");

  // Turn the sheet round and lean in on the map.
  pose(p.map, 505, 110, "inOutCubic");
  caption(1, 545, 700);
  pose(p.flat, 665, 65, "inOutCubic");

  // Fold it back up the way you would by hand: the long crease, then the concertina.
  fold("top", 1, 725, 85, "inOutQuad");
  fold("a", 1, 795, 100, "inOutSine");
  fold("b", 1, 812, 100, "inOutSine");
  fold("c", 1, 829, 100, "inOutSine");
  pose(p.upright, 735, 168, "inOutSine");
  caption(2, 740, 890);

  // It stands up, then settles back onto the desk; the pencil rolls home.
  caption(3, 920);
  pose(p.land, 905, 95, "outCubic");
  tl.add(rig, { away: 0, duration: 120, ease: "outQuad" }, 880);

  tl.add(el.bar, { width: ["0%", "100%"], duration: 1000, ease: "linear" }, 0);
  return tl;
}

/**
 * Scroll progress through `section` (0 at its top, 1 when its end reaches the
 * bottom of the window), eased toward the real position with frame-rate
 * independent damping so a flick of the wheel glides instead of jumping.
 * Runs only while the section is near the viewport; with reduced motion the
 * playhead follows the scroll exactly.
 */
function scrub(section: HTMLElement, apply: (p: number) => void): () => void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const read = () => {
    const r = section.getBoundingClientRect();
    const len = r.height - window.innerHeight;
    return len > 0 ? Math.min(1, Math.max(0, -r.top / len)) : 0;
  };
  let p = read();
  let last = performance.now();
  let raf = 0;
  let visible = true;
  apply(p);
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const target = read();
    p = reduce ? target : p + (target - p) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - p) < 0.0002) p = target;
    apply(p);
    raf = visible ? requestAnimationFrame(tick) : 0;
  };
  const io = new IntersectionObserver(
    ([e]) => {
      visible = !!e?.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    },
    { rootMargin: "200px" },
  );
  io.observe(section);
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
  };
}

export function Studio() {
  const section = useRef<HTMLElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const chapters = useRef<(HTMLDivElement | null)[]>([]);
  const copy = useRef<HTMLDivElement>(null);
  const stillRef = useRef<HTMLDivElement>(null);
  const rig = useRef<Rig>(initialRig(DESKTOP, DESKTOP_PEN));
  // Re-fit the scene when the window really changes size (rotation, a resized
  // desktop window); not for the address bar sliding in and out while scrolling.
  const [viewport, setViewport] = useState("");
  useEffect(() => {
    let t = 0;
    let last = { w: innerWidth, h: innerHeight };
    const on = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (innerWidth === last.w && Math.abs(innerHeight - last.h) < 120) return;
        last = { w: innerWidth, h: innerHeight };
        setViewport(`${innerWidth}x${innerHeight}`);
      }, 200);
    };
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      window.clearTimeout(t);
    };
  }, []);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  const [tier, setTier] = useState<Tier>("high");
  const data = useMemo(() => demoZine(), []);
  const onReady = useCallback(() => setReady(true), []);
  // WebGL waits until the page has loaded and the browser is idle, so it never
  // competes with the first paint; the still sheet shows on devices that can't.
  useEffect(() => {
    const t = deviceTier();
    setTier(t);
    if (t === "still" || !hasWebGL()) return setGl(false);
    let idle = 0;
    const start = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle = ric(() => setGl(true), { timeout: 1500 } as IdleRequestOptions);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.cancelIdleCallback?.(idle);
    };
  }, []);

  useEffect(() => {
    const m = window.matchMedia("(max-width: 767px)");
    const set = () => setMobile(m.matches);
    set();
    m.addEventListener("change", set);
    return () => m.removeEventListener("change", set);
  }, []);

  // (Re)build the timeline for this layout, and scrub it with the scroll.
  useEffect(() => {
    const s = section.current;
    if (!s || !hero.current || !cue.current || !veil.current || !bar.current) return;
    const fit = mobile && copy.current ? fitPhone(copy.current.offsetTop) : null;
    const poses = fit ? fit.poses : DESKTOP;
    Object.assign(rig.current, initialRig(poses, fit ? fit.pen : DESKTOP_PEN));
    // Tweens only apply once their start is reached, so set where the fallback sheet starts.
    if (stillRef.current) stillRef.current.style.opacity = mobile ? "0" : "";
    const tl = choreograph(rig.current, poses, {
      hero: hero.current,
      cue: cue.current,
      veil: veil.current,
      bar: bar.current,
      chapters: chapters.current.filter((c): c is HTMLDivElement => !!c),
      // On a phone the flat sheet would sit on top of the headline.
      still: mobile ? stillRef.current : null,
    });
    const stop = scrub(s, (p) => tl.seek(p * tl.duration));
    return () => {
      stop();
      tl.revert();
    };
  }, [mobile, viewport, gl]);

  // Stop drawing WebGL frames once the studio has scrolled away.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(!!e?.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const still = (
    <div
      ref={stillRef}
      className="absolute inset-0 flex items-start justify-center px-6 pt-[16svh] md:items-center md:justify-end md:pr-[5vw] md:pt-0"
    >
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
      ref={section}
      id="unfold"
      aria-label="Paper Trail, unfolded"
      className="relative h-[460vh]"
    >
      {/* The sheet the 3D paper is printed from (also exactly what you'd print).
          Client-only, and only when WebGL will use it: it isn't page content. */}
      {gl && (
        <div
          aria-hidden
          className="pointer-events-none fixed -left-[9999px] top-0 w-[1100px] opacity-0"
        >
          <Sheet data={data} id="studio-sheet" paperBg={false} />
        </div>
      )}

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
                    rig={rig}
                    sheetId="studio-sheet"
                    onReady={onReady}
                    active={active}
                    mobile={mobile}
                    low={tier === "low"}
                  />
                </SceneBoundary>
              )}
        </motion.div>

        {/* Hero */}
        <div
          ref={hero}
          className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-[var(--gutter)] pb-[9svh] md:justify-center md:pb-0"
        >
          {/* Entrance animations are CSS: they run from the first frame, before hydration. */}
          <div ref={copy} className="hero-copy max-w-[40rem]">
            <p
              className="fade-up label flex items-center gap-3"
              style={{ animationDelay: "100ms" }}
            >
              <span className="inline-block h-px w-8 bg-ink/40" aria-hidden />
              Printed walks for real streets
            </p>
            <h1 className="display mt-6 text-[clamp(3.3rem,1.4rem+7.4vw,8.4rem)]">
              <span className="block overflow-hidden pb-[0.06em]">
                {["The", "walk", "app", "that"].map((w, i) => (
                  <span
                    key={w}
                    className="rise pr-[0.2em]"
                    style={{ animationDelay: `${150 + i * 70}ms` }}
                  >
                    {w}
                  </span>
                ))}
              </span>
              <span className="block overflow-hidden pb-[0.12em]">
                <em
                  className="rise text-riso"
                  style={{ animationDelay: "460ms", animationDuration: "1.3s" }}
                >
                  stays home.
                </em>
              </span>
            </h1>
            <p className="fade-up lede mt-6 max-w-[33rem]" style={{ animationDelay: "700ms" }}>
              Paper Trail folds the streets around you into an eight-page paper zine: a hand-drawn
              map, things to spot, a riddle and a box to sketch in. Print it, leave your phone, go.
              When you&rsquo;re back, one photo and Gemma reads your pencil.
            </p>
            <div
              className="fade-up mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "850ms" }}
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
            </div>
            <div className="fade-up mt-8" style={{ animationDelay: "1100ms" }}>
              <ModelBadge />
            </div>
          </div>
        </div>

        <div
          ref={cue}
          className="pointer-events-none absolute inset-x-0 bottom-7 z-10 hidden justify-center md:flex"
        >
          <span className="label flex flex-col items-center gap-3">
            Scroll to unfold
            <span className="relative block h-10 w-px overflow-hidden bg-ink/15" aria-hidden>
              <span className="absolute inset-x-0 top-0 h-1/2 animate-[cue_1.8s_var(--ease-in-out-quart)_infinite] bg-ink" />
            </span>
          </span>
        </div>

        {/* A soft wash so chapter text stays readable over the paper. */}
        <div
          ref={veil}
          aria-hidden
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(90deg,rgba(241,237,228,0.95)_0%,rgba(241,237,228,0.7)_30%,transparent_50%)] max-md:bg-[linear-gradient(0deg,rgba(241,237,228,0.98)_0%,rgba(241,237,228,0.85)_36%,transparent_56%)]"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-[8svh] z-10 mx-auto max-w-7xl px-[var(--gutter)] md:bottom-auto md:top-1/2 md:-translate-y-1/2">
          <div className="relative h-64 max-w-[30rem] md:h-80">
            {CHAPTERS.map((c, i) => (
              <div
                key={c.n}
                ref={(el) => void (chapters.current[i] = el)}
                style={{ opacity: 0 }}
                className="absolute inset-x-0 bottom-0"
              >
                <div className="flex items-center gap-4">
                  <span className="font-serif text-[2.4rem] italic leading-none text-riso">
                    {c.n}.
                  </span>
                  <span className="h-px flex-1 bg-ink/25" aria-hidden />
                  <span className="label">{i + 1} / 4</span>
                </div>
                <h3 className="headline mt-5 text-[clamp(2.1rem,1.3rem+2.6vw,3.6rem)]">
                  {c.title}
                </h3>
                <p className="lede mt-4 max-w-md">{c.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reading progress for the story, like a fold line being scored. */}
        <div className="absolute inset-x-0 bottom-0 z-10 h-[2px] bg-ink/5" aria-hidden>
          <div ref={bar} className="h-full w-0 bg-riso" />
        </div>
      </div>
    </section>
  );
}
