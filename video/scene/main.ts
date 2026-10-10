/**
 * Paper Trail, 15 seconds. window.seek(t) draws the frame at time t; nothing
 * else moves. Two cuts share one timeline: 16x9 (1920×1080) and 4x5 (1080×1350),
 * each with its own layout rather than a crop.
 */
import { Stage, type SheetPose, type PhonePose } from "./stage";
import { SheetTexture, ROUTE_MM } from "./sheetTexture";
import { inlineFonts, loadZine, type Zine } from "./zine";
import { buildOverlays, type Overlays } from "./overlays";
import * as A from "./anim";
import type { Cues, VoLines } from "./cues";

export type Format = "16x9" | "4x5";

export interface Layout {
  W: number;
  H: number;
  sheet: Record<
    | "drop"
    | "land"
    | "push"
    | "lift"
    | "tiltA"
    | "tiltB"
    | "booklet"
    | "photo"
    | "photo2"
    | "flat"
    | "aside"
    | "end",
    SheetPose
  >;
  phone: PhonePose;
  phoneOutX: number;
}

const L: Record<Format, Layout> = {
  "16x9": {
    W: 1920,
    H: 1080,
    sheet: {
      drop: { x: 0.55, y: 3.1, z: 1.1, s: 1.42, rx: 0.42, ry: -0.2, rz: -0.34 },
      land: { x: 0.35, y: 0.02, z: 0.02, s: 1.42, rx: 0, ry: 0, rz: -0.035 },
      push: { x: 0.35, y: 0.02, z: 0, s: 1.47, rx: 0, ry: 0, rz: -0.03 },
      lift: { x: 0.3, y: 0.04, z: 0.32, s: 1.36, rx: -0.08, ry: 0.06, rz: -0.02 },
      tiltA: { x: 0.3, y: -0.35, z: 0.45, s: 1.42, rx: 0.55, ry: 0.1, rz: -0.02 },
      tiltB: { x: 0.35, y: 0.0, z: 0.45, s: 1.85, rx: -0.18, ry: 0.5, rz: 0.03 },
      booklet: { x: 0.3, y: 0.0, z: 0.12, s: 2.15, rx: 0.02, ry: 0.0, rz: 0.06 },
      photo: { x: 0.1, y: 0.08, z: 0.3, s: 1.3, rx: -0.72, ry: 0.34, rz: 0.12 },
      photo2: { x: 0.08, y: 0.07, z: 0.3, s: 1.32, rx: -0.68, ry: 0.31, rz: 0.11 },
      flat: { x: 0, y: 0.08, z: 0.1, s: 1.38, rx: 0, ry: 0, rz: 0 },
      aside: { x: -1.86, y: 0.02, z: 0.04, s: 1.02, rx: 0, ry: 0, rz: -0.025 },
      end: { x: 2.15, y: -0.06, z: 0.12, s: 1.95, rx: 0.03, ry: -0.02, rz: 0.1 },
    },
    phone: { x: -2.72, y: -0.32, rz: 0.27, s: 1 },
    phoneOutX: -5.4,
  },
  "4x5": {
    W: 1080,
    H: 1350,
    sheet: {
      drop: { x: 0.2, y: 3.2, z: 1.0, s: 0.97, rx: 0.42, ry: -0.2, rz: -0.34 },
      land: { x: 0, y: 0.52, z: 0, s: 0.97, rx: 0, ry: 0, rz: -0.035 },
      push: { x: 0, y: 0.52, z: 0, s: 1.0, rx: 0, ry: 0, rz: -0.03 },
      lift: { x: 0, y: 0.5, z: 0.3, s: 0.94, rx: -0.08, ry: 0.06, rz: -0.02 },
      tiltA: { x: 0, y: 0.2, z: 0.42, s: 0.98, rx: 0.55, ry: 0.1, rz: -0.02 },
      tiltB: { x: 0.05, y: 0.42, z: 0.42, s: 1.4, rx: -0.18, ry: 0.5, rz: 0.03 },
      booklet: { x: 0.05, y: 0.42, z: 0.12, s: 1.62, rx: 0.02, ry: 0.0, rz: 0.06 },
      photo: { x: 0, y: 0.22, z: 0.3, s: 0.9, rx: -0.72, ry: 0.34, rz: 0.12 },
      photo2: { x: 0, y: 0.21, z: 0.3, s: 0.91, rx: -0.68, ry: 0.31, rz: 0.11 },
      flat: { x: 0, y: 0.25, z: 0.1, s: 1.0, rx: 0, ry: 0, rz: 0 },
      aside: { x: 0, y: 1.02, z: 0.04, s: 0.74, rx: 0, ry: 0, rz: -0.025 },
      end: { x: 0.05, y: -0.72, z: 0.12, s: 1.5, rx: 0.03, ry: -0.02, rz: 0.08 },
    },
    phone: { x: -0.62, y: -1.12, rz: 1.3, s: 0.72 },
    phoneOutX: -3.4,
  },
};

const format = (new URLSearchParams(location.search).get("format") ?? "16x9") as Format;
const lay = L[format];

async function boot() {
  const [zine, cues, vo] = await Promise.all([
    loadZine("/video/build/zine.json"),
    fetch("/video/cues.json").then((r) => r.json() as Promise<Cues>),
    fetch("/video/build/vo/lines.json").then((r) => r.json() as Promise<VoLines>),
  ]);
  const frame = document.getElementById("frame")!;
  frame.style.width = `${lay.W}px`;
  frame.style.height = `${lay.H}px`;
  await document.fonts.load('400 40px "Instrument Serif"');
  await document.fonts.load('italic 400 40px "Instrument Serif"');
  await document.fonts.load('500 40px "Instrument Sans"');
  await document.fonts.load('400 20px "Fragment Mono"');
  await document.fonts.load('400 20px "Kalam"');

  const fontCss = await inlineFonts([
    ["Fraunces", 400, "normal", "fraunces-latin-400-normal"],
    ["Fraunces", 600, "normal", "fraunces-latin-600-normal"],
    ["Fraunces", 700, "normal", "fraunces-latin-700-normal"],
    ["Fraunces", 400, "italic", "fraunces-latin-400-italic"],
    ["Inter", 400, "normal", "inter-latin-400-normal"],
    ["Inter", 500, "normal", "inter-latin-500-normal"],
    ["Inter", 600, "normal", "inter-latin-600-normal"],
    ["IBM Plex Mono", 400, "normal", "ibm-plex-mono-latin-400-normal"],
    ["IBM Plex Mono", 500, "normal", "ibm-plex-mono-latin-500-normal"],
    ["Kalam", 400, "normal", "kalam-latin-400-normal"],
  ]);
  // The close-up shows real pages in the DOM, so their fonts are needed here too.
  const style = document.createElement("style");
  style.textContent = fontCss;
  document.head.appendChild(style);
  await document.fonts.load("400 10px Inter");
  await document.fonts.load('400 10px "IBM Plex Mono"');
  await document.fonts.load("400 10px Fraunces");
  const tex = new SheetTexture(zine);
  await tex.load(fontCss);

  const canvas = document.createElement("canvas");
  canvas.style.left = "0";
  canvas.style.top = "0";
  frame.appendChild(canvas);
  const stage = new Stage(canvas, lay.W, lay.H, tex.canvas);
  const ov = buildOverlays(frame, format, zine, vo, cues);
  await document.fonts.ready;

  const film = new Film(stage, tex, ov, zine, cues);
  (window as unknown as { seek: (t: number) => void }).seek = (t) => film.seek(t);
  film.seek(0);
  (window as unknown as { ready: boolean }).ready = true;
}

class Film {
  constructor(
    private stage: Stage,
    private tex: SheetTexture,
    private ov: Overlays,
    private zine: Zine,
    private cues: Cues,
  ) {}

  seek(time: number) {
    // The last half second is one held frame.
    const t = Math.min(time, this.cues.hold);
    const b = this.cues.beats;
    const real = t < b.closeup; // before the close-up: the walk-to-be; after: the photo and report

    // ---- the sheet's face ----
    const print = Array.from({ length: 8 }, (_, i) =>
      real ? A.inOutSine(A.prog(t, b.print + i * 0.3, b.print + i * 0.3 + 0.5)) : 1,
    );
    const drew = this.tex.draw({
      print,
      route: real ? A.inOutSine(A.prog(t, b.route, b.route + 1.0)) : 0,
      routeAlpha: real ? 1 : 0,
      marks: real ? 0 : 1,
    });
    if (drew) this.stage.texture.needsUpdate = true;

    // ---- the sheet's body ----
    const folds = this.folds(t, real);
    this.stage.set({
      sheet: this.pose(t, real),
      folds: { ...folds, flex: this.flex(t, real) },
      phone: {
        ...lay.phone,
        x: A.track(t, [
          [b.phoneOut, lay.phone.x],
          [b.phoneOut + 0.7, lay.phoneOutX, A.inCubic],
        ]),
      },
      visible: !(t >= b.closeup && t < b.photo),
    });
    this.stage.render();

    // ---- everything drawn over it ----
    const g = this.zine.geometry;
    const proj = (x: number, y: number) => this.stage.project(x, y);
    const pinAt = ROUTE_MM[0]!;
    this.ov.update(t, {
      pin: proj(pinAt[0], pinAt[1]),
      sheetTop: proj(g.w / 2, 0),
      sheetTopRight: proj(g.w, 0),
      fiducials: g.fiducials.map((f) => proj(f.cx, f.cy)),
      ticks: this.zine.ticks.map((k) => proj(k.centre.x, k.centre.y)),
      page4: (() => {
        const c = g.cells["4"]!;
        return { cell: c, proj };
      })(),
      print,
    });
  }

  private pose(t: number, real: boolean): SheetPose {
    const b = this.cues.beats;
    const s = lay.sheet;
    if (real)
      return A.pose(t, [
        [0, s.drop],
        [b.land, s.land, A.outCubic],
        [b.pin, s.land],
        [b.lift, s.push, A.inOutSine],
        [b.fold, s.lift, A.inOutSine],
        [b.fold + 0.4, s.tiltA, A.inOutSine],
        [b.fold + 0.95, s.tiltB, A.inOutSine],
        [b.fold + 1.45, s.booklet, A.inOutSine],
      ]);
    return A.pose(t, [
      [b.photo, s.photo],
      [b.flatten, s.photo2, A.linear],
      [b.flatten + 0.6, s.flat, A.expo],
      [b.report - 0.05, s.flat],
      [b.report + 0.4, s.aside, A.inOutCubic],
      [b.end, s.aside],
      [b.end + 0.85, s.end, A.inOutCubic],
    ]);
  }

  /** Fold the way you would by hand: the long crease, then the concertina, each a beat behind. */
  private folds(t: number, real: boolean) {
    const at = real ? this.cues.beats.fold : this.cues.beats.end + 0.05;
    if (!real && t < at) return { top: 0, a: 0, b: 0, c: 0 };
    return {
      top: A.inOutQuad(A.prog(t, at, at + 0.48)),
      a: A.inOutSine(A.prog(t, at + 0.36, at + 0.84)),
      b: A.inOutSine(A.prog(t, at + 0.5, at + 0.98)),
      c: A.inOutSine(A.prog(t, at + 0.64, at + 1.12)),
    };
  }

  /** Paper bows while its flaps swing: how fast the folds move, averaged over a short window. */
  private flex(t: number, real: boolean): number {
    const dt = 1 / 240;
    let sum = 0;
    const n = 6;
    for (let i = 0; i < n; i++) {
      const tt = t - i * 0.03;
      const f0 = this.folds(tt - dt, real);
      const f1 = this.folds(tt + dt, real);
      const v = Math.max(
        Math.abs(f1.top - f0.top),
        Math.abs(f1.a - f0.a),
        Math.abs(f1.b - f0.b),
        Math.abs(f1.c - f0.c),
      );
      sum += v / (2 * dt);
    }
    return A.clamp((sum / n) * 0.45);
  }
}

void boot();
