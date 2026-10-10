/**
 * Everything drawn over the 3D desk, as DOM and SVG: the pin, labels, stamps,
 * the pencil close-up, the camera, the Field Report and the end card.
 * Built once; update(t) only sets transforms, opacities and dash offsets.
 */
import * as A from "./anim";
import type { Format } from "./main";
import { tickPaths, type Cell, type Zine } from "./zine";
import type { Cues, VoLines } from "./cues";

type P = { x: number; y: number };
export interface Geo {
  pin: P;
  sheetTop: P;
  sheetTopRight: P;
  fiducials: P[];
  ticks: P[];
  page4: { cell: Cell; proj: (x: number, y: number) => P };
  print: number[];
}
export interface Overlays {
  update(t: number, g: Geo): void;
}

const RISO = "#2B3DD8";
const INK = "#151412";
const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="9" fill="#151412"/><rect x="5" y="8.5" width="22" height="15" rx="1.4" fill="#FBFAF6"/><path d="M10.5 8.5v15M16 8.5v15M21.5 8.5v15M5 16h22" stroke="#151412" stroke-opacity=".16" stroke-width=".8"/><path d="M10.5 16h11" stroke="#151412" stroke-width="1.1" stroke-dasharray="1.4 1.1"/><path d="M8.6 19.6c1.3-5.6 4.4-8.3 8.2-7.7 3.2.5 3.6 3.5 6.1 3.4 1.3 0 1.9-.9 2.1-1.8" stroke="#2B3DD8" stroke-width="1.7" stroke-linecap="round"/><circle cx="8.6" cy="19.6" r="1.9" fill="#2B3DD8" stroke="#FBFAF6" stroke-width=".9"/></svg>';
const CHECK =
  '<svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.6 4.5L19 7.5"/></svg>';

/** Per-cut layout of the 2D pieces. */
const K = {
  "16x9": {
    bug: { x: 56, y: 46, icon: 38, font: 19 },
    pin: 64,
    labelFont: 19,
    phoneStamp: { x: 430, y: 560, font: 40, rot: -8 },
    spread: { s: 8.9, cx: 820, cy: 540 },
    finder: { x0: 0.115, x1: 0.885, y0: 0.07, y1: 0.93, arm: 74 },
    marker: 54,
    chip: 38,
    card: { x: 1060, y: 112, w: 760, h: 856, enter: [900, 0] as [number, number] },
    end: { x: 150, lock: 296, l1: 362, l2: 494, size: 128, url: 704, urlSize: 30, icon: 50 },
    caption: { bottom: 40, size: 38, max: 1760 },
  },
  "4x5": {
    bug: { x: 44, y: 40, icon: 34, font: 17 },
    pin: 52,
    labelFont: 17,
    phoneStamp: { x: 420, y: 1060, font: 34, rot: -8 },
    spread: { s: 9.6, cx: 540, cy: 640 },
    finder: { x0: 0.06, x1: 0.94, y0: 0.08, y1: 0.8, arm: 64 },
    marker: 44,
    chip: 32,
    card: { x: 70, y: 636, w: 940, h: 560, enter: [0, 760] as [number, number] },
    end: { x: 80, lock: 112, l1: 174, l2: 292, size: 112, url: 448, urlSize: 26, icon: 44 },
    caption: { bottom: 52, size: 38, max: 960 },
  },
};

function el<T extends keyof HTMLElementTagNameMap>(
  tag: T,
  parent: HTMLElement,
  css: string,
  html = "",
  cls = "",
): HTMLElementTagNameMap[T] {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (cls) e.className = cls;
  e.innerHTML = html;
  parent.appendChild(e);
  return e;
}
const show = (e: HTMLElement | SVGElement, o: number, transform = "") => {
  e.style.opacity = String(A.clamp(o));
  e.style.visibility = o <= 0.001 ? "hidden" : "visible";
  if (transform) e.style.transform = transform;
};

export function buildOverlays(
  frame: HTMLElement,
  format: Format,
  zine: Zine,
  vo: VoLines,
  cues: Cues,
): Overlays {
  const k = K[format];
  const W = frame.clientWidth;
  const H = frame.clientHeight;
  const b = cues.beats;
  const g = zine.geometry;

  // ---------------- brand bug ----------------
  const bug = el(
    "div",
    frame,
    `left:${k.bug.x}px;top:${k.bug.y}px;display:flex;align-items:center;gap:14px;font-size:${k.bug.font}px;color:#46433D`,
    `<span style="width:${k.bug.icon}px;height:${k.bug.icon}px;display:block">${ICON}</span><span>Paper Trail</span>`,
    "mono",
  );

  // ---------------- pin ----------------
  const pinW = k.pin;
  const pin = el(
    "div",
    frame,
    `left:0;top:0;width:${pinW}px;height:${pinW * 1.3}px;transform-origin:50% 100%`,
    `<svg viewBox="0 0 56 72" width="100%" height="100%"><path d="M28 70C28 70 4 43 4 27a24 24 0 1 1 48 0C52 43 28 70 28 70Z" fill="${RISO}" stroke="#FBFAF6" stroke-width="2.5"/><circle cx="28" cy="27" r="9" fill="#FBFAF6"/></svg>`,
  );
  const pinShadow = el(
    "div",
    frame,
    `left:0;top:0;width:${pinW * 0.5}px;height:${pinW * 0.16}px;border-radius:50%;background:rgba(40,32,20,.35);filter:blur(4px)`,
  );

  // ---------------- Gemma label + page counter ----------------
  const label = el(
    "div",
    frame,
    `left:0;top:0;padding:10px 18px 10px 16px;font-size:${k.labelFont}px;display:flex;align-items:center;gap:12px;white-space:nowrap`,
    `<span style="width:10px;height:10px;background:${RISO};display:block"></span>Gemma 4 · Open model`,
    "mono pill",
  );
  const counter = el(
    "div",
    frame,
    `left:0;top:0;padding:10px 16px;font-size:${k.labelFont}px;white-space:nowrap;color:#46433D`,
    "",
    "mono pill",
  );

  // ---------------- "PHONE STAYS HOME" ----------------
  const ps = k.phoneStamp;
  const phoneStamp = el(
    "div",
    frame,
    `left:${ps.x}px;top:${ps.y}px;padding:${ps.font * 0.42}px ${ps.font * 0.7}px;font-size:${ps.font}px;white-space:nowrap;translate:-50% -50%`,
    "Phone stays home",
    "mono stamp",
  );

  // ---------------- the pencil close-up ----------------
  const pw = g.panelW;
  const ph = g.panelH;
  const sp = k.spread;
  const page = (n: number, x: number) =>
    (zine.pages[String(n)] ?? "").replace(
      "<svg ",
      `<svg x="${x}" y="0" width="${pw}" height="${ph}" `,
    );
  const closeup = el("div", frame, `left:0;top:0;width:${W}px;height:${H}px;background:#F1EDE4`);
  const spread = el(
    "div",
    closeup,
    `position:absolute;left:${sp.cx - (pw * sp.s) / 2}px;top:${sp.cy - (ph * sp.s) / 2}px;width:${2 * pw * sp.s}px;height:${ph * sp.s}px;transform-origin:${(pw * sp.s) / 2}px 50%;filter:drop-shadow(0 34px 44px rgba(58,47,31,.22)) drop-shadow(0 2px 3px rgba(58,47,31,.12))`,
    `<svg viewBox="0 0 ${2 * pw} ${ph}" width="100%" height="100%">
      ${page(4, 0)}${page(5, pw)}
      <defs><linearGradient id="gut" x1="0" x2="1"><stop offset="0" stop-color="#3a2f1f" stop-opacity="0"/><stop offset=".5" stop-color="#3a2f1f" stop-opacity=".16"/><stop offset="1" stop-color="#3a2f1f" stop-opacity="0"/></linearGradient></defs>
      <rect x="${pw - 7}" y="0" width="14" height="${ph}" fill="url(#gut)"/>
      <g id="ticks">${zine.ticks.map((t) => `<g data-i="${t.index}">${tickPaths(t, 0.62)}</g>`).join("")}</g>
    </svg>`,
  );
  const tickEls = zine.ticks.map((t) =>
    Array.from(spread.querySelectorAll<SVGPathElement>(`#ticks g[data-i="${t.index}"] path`)),
  );
  const tickLens = tickEls.map((ps) => ps.map((p) => p.getTotalLength()));
  tickEls.forEach((ps, i) =>
    ps.forEach((p, j) => {
      p.style.strokeDasharray = `${tickLens[i]![j]}`;
    }),
  );
  const ticked = zine.ticks.filter((t) => t.ticked).map((t) => t.index);
  const pencil = el(
    "div",
    frame,
    `left:0;top:0;width:0;height:0`,
    `<svg width="720" height="120" viewBox="0 -60 720 120" style="position:absolute;left:0;top:-60px;overflow:visible">
      <g class="shadow" style="filter:blur(9px)" opacity=".28"><path d="M0 0L66 -17H560V17H66Z" fill="#3a2f1f"/></g>
      <g class="body">
        <path d="M0 0L66 -17V17Z" fill="#E2C294"/>
        <path d="M0 0L20 -5.2V5.2Z" fill="#2a2a2c"/>
        <path d="M66 -17H540V-6H66Z" fill="#4A5BEA"/><path d="M66 -6H540V6H66Z" fill="${RISO}"/><path d="M66 6H540V17H66Z" fill="#1F2DA8"/>
        <path d="M66 -17L58 -6L66 -6Z M66 17L58 6L66 6Z" fill="#E2C294"/>
        <rect x="540" y="-17.5" width="40" height="35" fill="#C9C3B4"/><rect x="548" y="-17.5" width="3" height="35" fill="#a8a294"/><rect x="566" y="-17.5" width="3" height="35" fill="#a8a294"/>
        <path d="M580 -16.5H620Q628 -16.5 628 -8V8Q628 16.5 620 16.5H580Z" fill="#E9A8A0"/>
      </g></svg>`,
  );
  const pencilShadow = pencil.querySelector<SVGGElement>(".shadow")!;

  // ---------------- the camera ----------------
  const f = k.finder;
  const fx0 = W * f.x0;
  const fx1 = W * f.x1;
  const fy0 = H * f.y0;
  const fy1 = H * f.y1;
  const a = f.arm;
  const finder = el(
    "div",
    frame,
    `left:0;top:0;width:${W}px;height:${H}px;transform-origin:50% 50%`,
    `<svg width="${W}" height="${H}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round">
      <path d="M${fx0} ${fy0 + a}V${fy0}H${fx0 + a} M${fx1 - a} ${fy0}H${fx1}V${fy0 + a} M${fx1} ${fy1 - a}V${fy1}H${fx1 - a} M${fx0 + a} ${fy1}H${fx0}V${fy1 - a}"/>
    </svg>`,
  );
  const blinkTop = el(
    "div",
    frame,
    `left:0;top:0;width:${W}px;height:${H / 2 + 2}px;background:${INK}`,
  );
  const blinkBot = el(
    "div",
    frame,
    `left:0;bottom:0;top:auto;width:${W}px;height:${H / 2 + 2}px;background:${INK}`,
  );
  const marks = el(
    "div",
    frame,
    `left:0;top:0;width:${W}px;height:${H}px`,
    `<svg width="${W}" height="${H}" fill="none">
      <polygon class="quad" stroke="${RISO}" stroke-width="3" stroke-linejoin="round" fill="${RISO}" fill-opacity="0"/>
      <polygon class="scan" fill="${RISO}" fill-opacity=".14"/>
      <line class="scanline" stroke="${RISO}" stroke-width="3"/>
      ${[0, 1, 2, 3].map((i) => `<g class="m" data-i="${i}"><rect x="${-k.marker / 2}" y="${-k.marker / 2}" width="${k.marker}" height="${k.marker}" rx="4" stroke="${RISO}" stroke-width="4"/><circle r="5" fill="${RISO}"/></g>`).join("")}
    </svg>`,
  );
  const quad = marks.querySelector<SVGPolygonElement>(".quad")!;
  const scan = marks.querySelector<SVGPolygonElement>(".scan")!;
  const scanline = marks.querySelector<SVGLineElement>(".scanline")!;
  const markerEls = Array.from(marks.querySelectorAll<SVGGElement>(".m"));

  // ---------------- the Field Report ----------------
  const c = k.card;
  const wide = format === "16x9";
  const card = el(
    "div",
    frame,
    `left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;background:#FBFAF6;border-radius:6px;box-shadow:0 0 0 1px rgba(21,20,18,.08),0 40px 70px -34px rgba(58,47,31,.45),0 3px 6px rgba(58,47,31,.08)`,
  );
  const pad = wide ? 52 : 44;
  el(
    "div",
    card,
    `position:absolute;left:${pad}px;top:${wide ? 52 : 42}px;font-size:${wide ? 16 : 15}px;color:#46433D`,
    `The Trail Office · Field report · ${zine.date}`,
    "mono",
  );
  el(
    "div",
    card,
    `position:absolute;left:${pad}px;top:${wide ? 92 : 76}px;width:${wide ? 440 : 600}px;font-size:${wide ? 58 : 40}px;line-height:1;letter-spacing:-0.01em`,
    zine.title,
    "serif",
  );
  const countY = wide ? 292 : 140;
  const count = el(
    "div",
    card,
    `position:absolute;left:${pad}px;top:${countY}px;display:flex;align-items:baseline;gap:16px;white-space:nowrap`,
    `<span class="serif n" style="font-size:${wide ? 150 : 112}px;line-height:.8;font-variant-numeric:tabular-nums">0</span><span class="serif" style="font-size:${wide ? 46 : 38}px">of ${zine.score.of} found</span>`,
  );
  const countN = count.querySelector<HTMLSpanElement>(".n")!;
  const rowH = wide ? 44 : 56;
  const rowsTop = wide ? 450 : 262;
  const colW = wide ? c.w - 2 * pad : (c.w - 2 * pad - 28) / 2;
  const box = wide ? 26 : 26;
  const rowPos = zine.ticks.map((_, i) => {
    const col = wide ? 0 : Math.floor(i / 4);
    const row = wide ? i : i % 4;
    return { x: pad + col * (colW + 28), y: rowsTop + row * rowH };
  });
  const rows = zine.ticks.map((t, i) => {
    const r = el(
      "div",
      card,
      `position:absolute;left:${rowPos[i]!.x}px;top:${rowPos[i]!.y}px;width:${colW}px;height:${rowH - 8}px;display:flex;align-items:center;gap:14px;font-size:${wide ? 23 : 21}px;font-weight:500;border-bottom:1px dashed rgba(21,20,18,.14)`,
      `<span class="cb" style="width:${box}px;height:${box}px;border-radius:6px;box-shadow:inset 0 0 0 2px rgba(21,20,18,.28);flex:none"></span><span class="lab" style="flex:1;white-space:nowrap">${t.label}</span><span class="mono" style="font-size:${wide ? 16 : 15}px;letter-spacing:.04em;color:#46433D">${t.points}</span>`,
    );
    return {
      r,
      cb: r.querySelector<HTMLSpanElement>(".cb")!,
      lab: r.querySelector<HTMLSpanElement>(".lab")!,
    };
  });
  const postmark = el(
    "div",
    card,
    `position:absolute;right:${wide ? 48 : 40}px;top:${wide ? 44 : 30}px;width:${wide ? 200 : 180}px;padding:14px 10px;font-size:${wide ? 14 : 13}px`,
    `<div>The Trail Office</div><div class="serif" style="font-size:${wide ? 46 : 40}px;text-transform:none;letter-spacing:0;line-height:1.05;margin:4px 0">${zine.score.total} pts</div><div>${zine.date} · walked</div>`,
    "mono stamp",
  );
  // A tick's flight ends on its row's checkbox (card-relative centre).
  const target = (i: number) => ({
    x: c.x + rowPos[i]!.x + box / 2,
    y: c.y + rowPos[i]!.y + (rowH - 8) / 2,
  });
  const chips = ticked.map(() =>
    el(
      "div",
      frame,
      `left:0;top:0;width:${k.chip}px;height:${k.chip}px;background:${RISO};display:grid;place-items:center;translate:-50% -50%;box-shadow:0 8px 16px -8px rgba(21,20,18,.5)`,
      CHECK,
    ),
  );

  // ---------------- the end card ----------------
  const e = k.end;
  const endLock = el(
    "div",
    frame,
    `left:${e.x}px;top:${e.lock}px;display:flex;align-items:center;gap:16px;font-size:${wide ? 21 : 19}px;color:#46433D`,
    `<span style="width:${e.icon}px;height:${e.icon}px;display:block">${ICON}</span><span>Paper Trail</span>`,
    "mono",
  );
  const l5 = vo.lines.find((l) => l.line === 5)!;
  const at5 = cues.vo.find((v) => v.line === 5)!.at;
  const headWords = l5.words.map((w) => w.w);
  const line1 = el(
    "div",
    frame,
    `left:${e.x - 4}px;top:${e.l1}px;font-size:${e.size}px;line-height:1.08;letter-spacing:-0.02em;overflow:hidden;white-space:nowrap;padding:0 8px 0 4px`,
    headWords
      .slice(0, 4)
      .map((w) => `<span style="display:inline-block">${w}</span>`)
      .join(" "),
    "serif",
  );
  const line2 = el(
    "div",
    frame,
    `left:${e.x - 4}px;top:${e.l2}px;font-size:${e.size}px;line-height:1.08;letter-spacing:-0.02em;overflow:hidden;white-space:nowrap;font-style:italic;color:${RISO};padding:0 12px 0 4px`,
    headWords
      .slice(4)
      .map(
        (w, i, arr) =>
          `<span style="display:inline-block">${w}${i === arr.length - 1 ? "." : ""}</span>`,
      )
      .join(" "),
    "serif",
  );
  const headSpans = [...line1.querySelectorAll("span"), ...line2.querySelectorAll("span")];
  const url = el(
    "div",
    frame,
    `left:${e.x}px;top:${e.url}px;font-family:'Fragment Mono',monospace;font-size:${e.urlSize}px;color:#46433D;display:flex;align-items:center;gap:14px`,
    `<span style="width:${e.urlSize * 0.5}px;height:${e.urlSize * 0.5}px;background:${RISO};display:block"></span>paper-trail-t6mp.onrender.com`,
  );

  // ---------------- captions ----------------
  const cap = k.caption;
  const captions = vo.lines
    .filter((l) => l.line !== 5) // the end card's headline is the caption for the last line
    .map((l) => {
      const at = cues.vo.find((v) => v.line === l.line)!.at;
      const box = el(
        "div",
        frame,
        `left:50%;bottom:${cap.bottom}px;top:auto;translate:-50% 0;max-width:${cap.max}px;width:max-content;padding:12px 28px 14px;font-size:${cap.size}px;font-weight:500;line-height:1.25;text-align:center;border-radius:18px`,
        l.words.map((w) => `<span>${w.w}</span>`).join(" "),
        "pill",
      );
      // Put the punctuation back: the word list has none, the line text does.
      const spans = Array.from(box.querySelectorAll("span"));
      let rest = l.text;
      spans.forEach((s) => {
        const i = rest.indexOf(s.textContent ?? "");
        const after = rest.slice(i + (s.textContent ?? "").length).match(/^[^\s\w]*/)?.[0] ?? "";
        s.textContent = (s.textContent ?? "") + after;
        rest = rest.slice(i + (s.textContent ?? "").length);
      });
      return { box, spans, words: l.words, at, dur: l.dur };
    });

  return {
    update(t, geo) {
      // brand bug
      show(bug, A.prog(t, 0.1, 0.4) * (1 - A.prog(t, b.photo - 0.1, b.photo)));

      // pin: falls onto the sheet and lands on the beat, leaves when printing is done
      const fall = A.prog(t, b.pin - 0.25, b.pin);
      const away = A.outCubic(A.prog(t, b.lift - 0.15, b.lift + 0.1));
      const lift = A.inCubic(1 - fall) * 320 + away * 40;
      show(
        pin,
        (t > b.pin - 0.25 ? 1 : 0) * (1 - away),
        `translate(${geo.pin.x - pinW / 2}px, ${geo.pin.y - pinW * 1.3 - lift}px) scale(${1 - 0.3 * away})`,
      );
      show(
        pinShadow,
        (t > b.pin - 0.25 ? 0.25 + 0.75 * fall : 0) * (1 - away),
        `translate(${geo.pin.x - pinW * 0.25}px, ${geo.pin.y - pinW * 0.08}px) scale(${0.5 + 0.5 * fall})`,
      );

      // label + counter
      const lin = A.spring(t, 2.1, 16) * (1 - A.prog(t, b.lift + 0.05, b.lift + 0.25));
      const lw = label.offsetWidth;
      show(
        label,
        lin,
        `translate(${geo.sheetTop.x - lw / 2}px, ${geo.sheetTop.y - 64 + 10 * (1 - lin)}px)`,
      );
      const started = geo.print.filter((p) => p > 0).length;
      counter.textContent = `Page ${Math.max(1, started)} / 8`;
      const cin = A.spring(t, b.print, 16) * (1 - A.prog(t, b.lift + 0.05, b.lift + 0.25));
      show(
        counter,
        wide ? cin : 0,
        `translate(${geo.sheetTopRight.x - counter.offsetWidth}px, ${geo.sheetTop.y - 64 + 10 * (1 - cin)}px)`,
      );

      // PHONE STAYS HOME: lands on the beat, no bounce
      const st = A.outQuart(A.prog(t, b.phoneStamp - 0.14, b.phoneStamp));
      show(
        phoneStamp,
        t < b.closeup ? st : 0,
        `rotate(${ps.rot - 6 * (1 - st)}deg) scale(${1 + 0.45 * (1 - st)})`,
      );

      // close-up: the I-Spy page, ticked one row at a time
      const inClose = t >= b.closeup && t < b.photo;
      show(closeup, inClose ? 1 : 0);
      const push = A.inOutSine(A.prog(t, b.closeup, b.photo));
      spread.style.transform = `rotate(${-1.4 + 0.5 * push}deg) scale(${1.0 + 0.05 * push})`;
      const tk = b.ticks;
      let tip: P | null = null;
      let lifted = 1;
      ticked.forEach((idx, j) => {
        const s0 = tk[j]!;
        const p = A.inOutSine(A.prog(t, s0, s0 + 0.14));
        tickEls[idx]!.forEach((path, n) => {
          const len = tickLens[idx]![n]!;
          path.style.strokeDashoffset = String(len * (1 - p));
        });
        if (t >= s0 && t <= s0 + 0.14) {
          tip = pointOn(tickEls[idx]![0]!, tickLens[idx]![0]! * p);
          lifted = 0;
        }
      });
      if (inClose && !tip) {
        // Between strokes the pencil travels, lifted, to where the next one starts.
        const startOf = (j: number) => pointOn(tickEls[ticked[j]!]![0]!, 0);
        const endOf = (j: number) => pointOn(tickEls[ticked[j]!]![0]!, tickLens[ticked[j]!]![0]!);
        const off = { x: W * 1.08, y: H * 1.1 };
        const first = tk[0]!;
        const last = tk[ticked.length - 1]! + 0.14;
        if (t < first) {
          const q = A.outCubic(A.prog(t, b.closeup, first));
          tip = mix(off, startOf(0), q);
          lifted = 1 - q * 0.8;
        } else if (t > last) {
          const q = A.inCubic(A.prog(t, last, b.photo));
          tip = mix(endOf(ticked.length - 1), off, q);
          lifted = 0.2 + q;
        } else {
          const j = tk.findIndex((s) => s > t) - 1;
          const q = A.inOutSine(A.prog(t, tk[j]! + 0.14, tk[j + 1]!));
          tip = mix(endOf(j), startOf(j + 1), q);
          lifted = Math.sin(Math.PI * q) * 0.8 + 0.2;
        }
      }
      const tp: P = tip ?? { x: -999, y: -999 };
      show(
        pencil,
        inClose ? 1 : 0,
        `translate(${tp.x}px, ${tp.y}px) rotate(-52deg) scale(${(wide ? 1 : 0.95) * (1 + 0.03 * lifted)})`,
      );
      pencilShadow.setAttribute("transform", `translate(${10 + 26 * lifted} ${16 + 30 * lifted})`);

      // the camera: viewfinder, shutter, four corner markers, then the flattened sheet
      const fin = A.spring(t, b.photo, 22) * (1 - A.prog(t, b.flatten, b.flatten + 0.25));
      show(finder, t >= b.photo ? fin : 0, `scale(${1 + 0.04 * (1 - A.spring(t, b.photo, 22))})`);
      const close =
        A.prog(t, b.shutter - 0.05, b.shutter) *
        (1 - A.prog(t, b.shutter + 0.03, b.shutter + 0.11));
      show(blinkTop, close > 0 ? 1 : 0, `translateY(${-(1 - close) * (H / 2 + 2)}px)`);
      show(blinkBot, close > 0 ? 1 : 0, `translateY(${(1 - close) * (H / 2 + 2)}px)`);
      const markOut = 1 - A.prog(t, b.report, b.report + 0.2);
      markerEls.forEach((m, i) => {
        const m0 = b.markers[i]!;
        const sp1 = A.spring(t, m0, 34);
        const p = geo.fiducials[i]!;
        m.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${1.8 - 0.8 * sp1})`);
        m.style.opacity = String(t >= m0 ? A.prog(t, m0, m0 + 0.05) * markOut : 0);
      });
      const qd = A.inOutSine(A.prog(t, b.markers[3]! + 0.02, b.markers[3]! + 0.2));
      const fp = geo.fiducials;
      quad.setAttribute("points", fp.map((p) => `${p.x},${p.y}`).join(" "));
      const per = fp.reduce((s, p, i) => s + dist(p, fp[(i + 1) % 4]!), 0);
      quad.style.strokeDasharray = `${per}`;
      quad.style.strokeDashoffset = String(per * (1 - qd));
      quad.style.opacity = String(t >= b.markers[3]! ? markOut : 0);
      quad.setAttribute(
        "fill-opacity",
        String(0.06 * A.prog(t, b.flatten, b.flatten + 0.3) * markOut),
      );

      // reading: a band sweeps the I-Spy page (printed upside down, so from the cell's bottom up)
      const cell = geo.page4.cell;
      const rk = A.inOutSine(A.prog(t, b.read, b.read + 0.38));
      const scanOn =
        t >= b.read && t < b.read + 0.5 ? 1 - A.prog(t, b.read + 0.38, b.read + 0.5) : 0;
      const yb = cell.y + cell.h * (1 - rk);
      const pr = geo.page4.proj;
      const band = [
        pr(cell.x, yb),
        pr(cell.x + cell.w, yb),
        pr(cell.x + cell.w, yb + 7),
        pr(cell.x, yb + 7),
      ];
      scan.setAttribute("points", band.map((p) => `${p.x},${p.y}`).join(" "));
      scan.style.opacity = String(scanOn);
      scanline.setAttribute("x1", String(band[0]!.x));
      scanline.setAttribute("y1", String(band[0]!.y));
      scanline.setAttribute("x2", String(band[1]!.x));
      scanline.setAttribute("y2", String(band[1]!.y));
      scanline.style.opacity = String(scanOn);

      // ticks found → chips → they fly into the report and become its checkboxes
      const cardIn = A.inOutCubic(A.prog(t, b.report, b.report + 0.4));
      const cardOut = A.inCubic(A.prog(t, b.end, b.end + 0.45));
      const [ex, ey] = c.enter;
      show(
        card,
        t >= b.report ? 1 : 0,
        `translate(${ex * (1 - cardIn)}px, ${ey * (1 - cardIn) + cardOut * (H - c.y + 60)}px) rotate(${2 * (1 - cardIn)}deg)`,
      );
      let landed = 0;
      ticked.forEach((idx, j) => {
        const chip = chips[j]!;
        const found = b.read + 0.38 * (1 - (zine.ticks[idx]!.centre.y - cell.y) / cell.h);
        const pop = A.spring(t, found, 26);
        const f0 = b.report + 0.12 + 0.05 * j;
        const fl = A.inOutCubic(A.prog(t, f0, f0 + 0.36));
        const from = geo.ticks[idx]!;
        const card0 = { x: ex * (1 - cardIn), y: ey * (1 - cardIn) };
        const to0 = target(idx);
        const to = { x: to0.x + card0.x, y: to0.y + card0.y };
        const pos = mix(from, to, fl);
        pos.y -= Math.sin(Math.PI * fl) * (wide ? 90 : 70);
        const size = A.lerp(k.chip, box, fl);
        const isLanded = t >= f0 + 0.36;
        if (isLanded) landed++;
        chip.style.width = chip.style.height = `${size}px`;
        chip.style.borderRadius = `${A.lerp(size / 2, 6, fl)}px`;
        show(
          chip,
          t >= found && !isLanded ? 1 : 0,
          `translate(${pos.x}px, ${pos.y}px) scale(${pop})`,
        );
        rows[idx]!.cb.style.background = isLanded ? RISO : "transparent";
        rows[idx]!.cb.innerHTML = isLanded ? CHECK : "";
        rows[idx]!.cb.style.display = "grid";
        rows[idx]!.cb.style.placeItems = "center";
      });
      rows.forEach((r, i) => {
        const done = zine.ticks[i]!.ticked && r.cb.style.background !== "transparent";
        r.lab.style.color = done ? INK : "rgba(21,20,18,.42)";
      });
      countN.textContent = String(landed);
      const pm = A.outQuart(A.prog(t, b.postmark - 0.14, b.postmark));
      show(postmark, pm, `rotate(${-10 - 6 * (1 - pm)}deg) scale(${1 + 0.5 * (1 - pm)})`);

      // end card: the headline rises word by word with the voice
      const lockIn = A.spring(t, at5 + 0.15, 16);
      show(endLock, lockIn, `translateY(${14 * (1 - lockIn)}px)`);
      headSpans.forEach((s, i) => {
        const w = l5.words[i]!;
        const q = A.expo(A.prog(t, at5 + w.s - 0.04, at5 + w.s + 0.36));
        s.style.transform = `translateY(${(1 - q) * 105}%)`;
        s.style.opacity = String(q > 0 ? 1 : 0);
      });
      show(line1, t >= at5 - 0.1 ? 1 : 0);
      show(line2, t >= at5 - 0.1 ? 1 : 0);
      const homeAt = at5 + l5.words[l5.words.length - 1]!.s;
      const ui = A.spring(t, homeAt + 0.05, 16);
      show(url, ui, `translateY(${12 * (1 - ui)}px)`);

      // captions: one line at a time, each word lighting up as it is said
      captions.forEach((cp, i) => {
        const next = captions[i + 1]?.at ?? Infinity;
        // A line is fully gone before the next one starts to appear: pills never overlap.
        const end = Math.min(cp.at + cp.dur + 0.35, next - 0.26);
        const o = A.prog(t, cp.at - 0.12, cp.at) * (1 - A.prog(t, end, end + 0.12));
        show(cp.box, o, `translateY(${8 * (1 - A.prog(t, cp.at - 0.12, cp.at))}px)`);
        cp.spans.forEach((s, j) => {
          const w = cp.words[j]!;
          s.style.opacity = String(0.36 + 0.64 * A.prog(t, cp.at + w.s - 0.03, cp.at + w.s + 0.07));
        });
      });
    },
  };
}

function pointOn(path: SVGPathElement, l: number): P {
  const p = path.getPointAtLength(l);
  const m = path.getScreenCTM()!;
  const q = new DOMPoint(p.x, p.y).matrixTransform(m);
  return { x: q.x, y: q.y };
}
const mix = (a: P, b: P, k: number): P => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
