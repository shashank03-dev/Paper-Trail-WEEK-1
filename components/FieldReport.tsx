"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FieldReport as Report } from "@/lib/schemas";
import { score as scoreOf } from "@/lib/reader/score";
import { fmtDuration } from "@/lib/client/trail";
import { loadSettings, saveSettings } from "@/lib/client/settings";
import { Icon3D } from "./Icon3D";

export interface ReportProps {
  title: string;
  date: number;
  report: Report;
  labels: string[];
  points: number[];
  screenMs: number;
  outsideMs: number | null;
  sketchSrc?: string;
  debug?: boolean;
  inBook: boolean;
  trailId: string;
  onChange: (r: Report) => void;
  onAddToBook: () => void;
}

/** A rubber-stamp thump synthesised with WebAudio (no audio files). */
function thump() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(140, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.9, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.3);
  } catch {
    /* no audio */
  }
}

const VERDICT: Record<Report["riddle"]["verdict"], { label: string; cls: string }> = {
  correct: { label: "Right!", cls: "bg-teal text-white" },
  close: { label: "Close", cls: "bg-sun" },
  incorrect: { label: "Not quite", cls: "bg-desk" },
  blank: { label: "Left blank", cls: "bg-desk" },
};

export function FieldReport(p: ReportProps) {
  const [stamped, setStamped] = useState(false);
  const [sound, setSound] = useState(false);
  const s = scoreOf(p.report, p.points);
  useEffect(() => {
    setSound(!!loadSettings().sound);
    const t = window.setTimeout(() => {
      setStamped(true);
      if (loadSettings().sound) window.setTimeout(thump, 380);
    }, 900);
    return () => window.clearTimeout(t);
  }, []);
  const toggle = (i: number) =>
    p.onChange({
      ...p.report,
      ispy: p.report.ispy.map((it) =>
        it.index === i
          ? { ...it, spotted: !it.spotted, source: "user", unsure: false, confidence: 1 }
          : it,
      ),
    });
  const total = p.screenMs + (p.outsideMs ?? 0);
  const pct = p.outsideMs ? Math.max(1, Math.round((p.screenMs / total) * 100)) : null;
  const dateStr = new Date(p.date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const listen = [
    ["The loudest sound", p.report.listen.loudest],
    ["The quietest sound", p.report.listen.quietest],
    ["A sound you'd never noticed", p.report.listen.newSound],
  ] as const;
  const v = VERDICT[p.report.riddle.verdict];

  return (
    <div className="pop-in" data-testid="field-report">
      <div className="relative grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section
          className="paper-card relative overflow-hidden p-6 sm:p-8"
          aria-labelledby="report-title"
        >
          <p className="kicker">Field Report · {dateStr}</p>
          <h2 id="report-title" className="display mt-1 text-3xl sm:text-4xl">
            {p.title}
          </h2>
          <div className="mt-6 flex items-end gap-3">
            <span className="display text-6xl text-pink" data-testid="score">
              {s.total}
            </span>
            <span className="pb-2 text-sm text-muted">
              points · spotted {s.spotted} of {s.of}
            </span>
          </div>

          {/* The stamp slams onto the report. */}
          <div
            className="stage pointer-events-none absolute right-4 top-4 sm:right-8 sm:top-8"
            aria-hidden={!stamped}
          >
            {stamped && (
              <div
                className="slam stamp grid w-40 place-items-center px-3 py-3 text-center sm:w-48"
                data-testid="stamp"
              >
                <div className="text-[0.6rem]">The Trail Office</div>
                <div className="display my-1 text-2xl normal-case tracking-normal">
                  {s.total} pts
                </div>
                <div className="text-[0.6rem]">{dateStr} · walked</div>
              </div>
            )}
          </div>

          <h3 className="display mt-8 flex items-center gap-2 text-xl">
            <Icon3D name="magnifier" size={28} /> I-Spy
          </h3>
          <p className="text-xs text-muted">
            Tap any item to fix it. Amber ones are where Gemma and the tick-counter disagreed.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {p.report.ispy.map((it) => (
              <li key={it.index}>
                <button
                  type="button"
                  aria-pressed={it.spotted}
                  onClick={() => toggle(it.index)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left text-sm transition-all ${it.unsure ? "border-sun bg-[#fff6dc]" : "border-ink/15 bg-card"} ${it.spotted ? "" : "opacity-60"}`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 border-ink ${it.spotted ? "bg-ink text-paper" : "bg-white"}`}
                    aria-hidden
                  >
                    {it.spotted ? "✓" : ""}
                  </span>
                  <span className="flex-1 font-medium">
                    {p.labels[it.index] ?? `Item ${it.index + 1}`}
                  </span>
                  <span className="mono text-xs text-pink">{p.points[it.index] ?? 0}</span>
                  {p.debug && (
                    <span className="mono text-[0.6rem] text-muted">
                      g:{it.gemma === null || it.gemma === undefined ? "–" : it.gemma ? "✓" : "✗"}{" "}
                      omr:{it.omrInk?.toFixed(3) ?? "–"} {it.source}{" "}
                      {Math.round(it.confidence * 100)}%
                    </span>
                  )}
                  {!p.debug && it.unsure && <span className="mono text-[0.6rem]">unsure</span>}
                </button>
              </li>
            ))}
          </ul>

          <h3 className="display mt-8 flex items-center gap-2 text-xl">
            <Icon3D name="ear" size={28} /> What you heard
          </h3>
          <dl className="mt-3 grid gap-3">
            {listen.map(([k, val]) => (
              <div key={k} className="border-b-2 border-dashed border-line pb-2">
                <dt className="text-xs font-semibold text-muted">{k}</dt>
                <dd className={`hand text-3xl leading-tight ${val ? "text-ink" : "text-muted/60"}`}>
                  {val ?? "(left blank)"}
                </dd>
              </div>
            ))}
          </dl>

          <h3 className="display mt-8 flex items-center gap-2 text-xl">
            <Icon3D name="sparkles" size={28} /> The riddle
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="hand text-3xl">{p.report.riddle.written ?? "—"}</span>
            <span
              className={`mono rounded-full px-3 py-1 text-xs font-semibold ${v.cls}`}
              data-testid="verdict"
            >
              {v.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink/80">{p.report.riddle.note}</p>

          <h3 className="display mt-8 flex items-center gap-2 text-xl">
            <Icon3D name="palette" size={28} /> Your sketch
          </h3>
          <div className="mt-3 flex gap-4">
            {p.sketchSrc && (
              <img
                src={p.sketchSrc}
                alt="Your sketch, as photographed"
                className="h-36 w-auto rounded-md border-2 border-ink/20 bg-white object-contain"
              />
            )}
            <p className="display self-center text-lg italic leading-snug">
              “{p.report.sketch.description}”
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="card overflow-hidden p-6" aria-labelledby="svo">
            <h3 id="svo" className="kicker">
              Screen vs Outside
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <Icon3D name="laptop" size={36} />
                <div className="display mt-1 text-3xl" data-testid="screen-time">
                  {fmtDuration(p.screenMs)}
                </div>
                <div className="text-xs text-muted">on Paper Trail</div>
              </div>
              <div>
                <Icon3D name="tree" size={36} />
                <div className="display mt-1 text-3xl text-teal" data-testid="outside-time">
                  {p.outsideMs !== null ? fmtDuration(p.outsideMs) : "—"}
                </div>
                <div className="text-xs text-muted">outside, phone at home</div>
              </div>
            </div>
            {pct !== null ? (
              <>
                <div
                  className="mt-5 flex h-4 overflow-hidden rounded-full border-2 border-ink"
                  role="img"
                  aria-label={`Screen was ${pct}% of the adventure`}
                >
                  <div className="bg-pink" style={{ width: `${pct}%` }} />
                  <div className="flex-1 bg-teal" />
                </div>
                <p className="display mt-3 text-xl">
                  Your screen was <span className="text-pink">{pct}%</span> of this adventure.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">
                Print from Paper Trail next time and we’ll time the outside part too.
              </p>
            )}
          </section>

          <section className="paper-card relative p-6" aria-labelledby="letter">
            <Icon3D
              name="envelope"
              size={44}
              float
              tilt={-10}
              className="absolute -right-3 -top-5"
            />
            <h3 id="letter" className="kicker">
              A note from The Trail Office
            </h3>
            <p className="display mt-3 whitespace-pre-line text-lg leading-relaxed">
              {p.report.letter}
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={p.onAddToBook}
              disabled={p.inBook}
              data-testid="add-to-book"
            >
              <Icon3D name="book" size={22} />{" "}
              {p.inBook ? "In your Trail Book" : "Add to Trail Book"}
            </button>
            <Link href={`/postcard/${p.trailId}`} className="btn">
              <Icon3D name="postbox" size={22} /> Print reply postcard
            </Link>
            <button
              type="button"
              className="btn btn-sm"
              aria-pressed={sound}
              onClick={() => {
                const n = !sound;
                setSound(n);
                saveSettings({ ...loadSettings(), sound: n });
                if (n) thump();
              }}
            >
              {sound ? "🔊 Stamp sound on" : "🔇 Stamp sound off"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
