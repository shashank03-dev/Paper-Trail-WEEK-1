"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FieldReport as Report } from "@/lib/schemas";
import { score as scoreOf } from "@/lib/reader/score";
import { fmtDuration } from "@/lib/client/trail";
import { loadSettings, saveSettings } from "@/lib/client/settings";
import { BookOpen, Check, Mail, Volume2, VolumeX } from "lucide-react";

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
  correct: { label: "Right!", cls: "bg-grass-ink text-white" },
  close: { label: "Close", cls: "bg-[#f1d9a7] text-paper-ink" },
  incorrect: { label: "Not quite", cls: "bg-paper-2 text-paper-ink" },
  blank: { label: "Left blank", cls: "bg-paper-2 text-paper-ink" },
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
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* The report itself, as a sheet of paper from The Trail Office. */}
        <section
          className="paper relative overflow-hidden p-7 sm:p-10"
          aria-labelledby="report-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="mono text-[0.68rem] uppercase tracking-[0.16em] text-paper-mute">
                Field report · {dateStr}
              </p>
              <h2
                id="report-title"
                className="h2 mt-3 text-[clamp(2rem,1.4rem+2vw,3rem)] text-paper-ink"
              >
                {p.title}
              </h2>
            </div>
            <div
              className="stage pointer-events-none min-h-[6.5rem] min-w-[11rem]"
              aria-hidden={!stamped}
            >
              {stamped && (
                <div
                  className="slam stamp grid w-44 place-items-center px-3 py-3 text-center"
                  data-testid="stamp"
                >
                  <div className="text-[0.6rem]">The Trail Office</div>
                  <div className="h2 my-1 text-2xl normal-case tracking-normal">{s.total} pts</div>
                  <div className="text-[0.6rem]">{dateStr} · walked</div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="h2 text-7xl text-paper-ink" data-testid="score">
              {s.total}
            </span>
            <span className="muted pb-2.5 text-sm">
              points · spotted {s.spotted} of {s.of}
            </span>
          </div>

          <div className="mt-10 h-px bg-paper-ink/10" />
          <h3 className="mono mt-8 text-[0.7rem] uppercase tracking-[0.16em] text-paper-mute">
            I-Spy
          </h3>
          <p className="muted mt-1 text-xs">
            Tap anything we got wrong. Amber ones are where the model and the tick-counter
            disagreed.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {p.report.ispy.map((it) => (
              <li key={it.index}>
                <button
                  type="button"
                  aria-pressed={it.spotted}
                  onClick={() => toggle(it.index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${it.unsure ? "bg-[#f3dfb4]" : "bg-paper-2/70 hover:bg-paper-2"} ${it.spotted ? "text-paper-ink" : "text-paper-mute"}`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${it.spotted ? "bg-paper-ink text-paper" : "shadow-[inset_0_0_0_1.5px_rgb(26_25_21/0.35)]"}`}
                    aria-hidden
                  >
                    {it.spotted && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 font-medium">
                    {p.labels[it.index] ?? `Item ${it.index + 1}`}
                  </span>
                  <span className="mono text-xs">{p.points[it.index] ?? 0}</span>
                  {p.debug && (
                    <span className="mono text-[0.6rem]">
                      g:{it.gemma === null || it.gemma === undefined ? "–" : it.gemma ? "✓" : "✗"}{" "}
                      omr:{it.omrInk?.toFixed(3) ?? "–"} {it.source}{" "}
                      {Math.round(it.confidence * 100)}%
                    </span>
                  )}
                  {!p.debug && it.unsure && <span className="mono text-[0.6rem]">check</span>}
                </button>
              </li>
            ))}
          </ul>

          <h3 className="mono mt-10 text-[0.7rem] uppercase tracking-[0.16em] text-paper-mute">
            What you heard
          </h3>
          <dl className="mt-3 grid gap-4">
            {listen.map(([k, val]) => (
              <div key={k} className="border-b border-dashed border-paper-ink/15 pb-2">
                <dt className="muted text-xs">{k}</dt>
                <dd
                  className={`hand text-[2rem] leading-tight ${val ? "text-paper-ink" : "text-paper-mute"}`}
                >
                  {val ?? "(left blank)"}
                </dd>
              </div>
            ))}
          </dl>

          <h3 className="mono mt-10 text-[0.7rem] uppercase tracking-[0.16em] text-paper-mute">
            The riddle
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="hand text-[2rem] leading-tight">{p.report.riddle.written ?? "—"}</span>
            <span
              className={`mono rounded-full px-3 py-1 text-xs font-medium ${v.cls}`}
              data-testid="verdict"
            >
              {v.label}
            </span>
          </div>
          <p className="muted mt-1 text-sm">{p.report.riddle.note}</p>

          <h3 className="mono mt-10 text-[0.7rem] uppercase tracking-[0.16em] text-paper-mute">
            Your sketch
          </h3>
          <div className="mt-3 flex gap-5">
            {p.sketchSrc && (
              <img
                src={p.sketchSrc}
                alt="Your sketch, as photographed"
                className="h-36 w-auto rounded-sm bg-white object-contain shadow-[0_0_0_1px_rgb(26_25_21/0.1)]"
              />
            )}
            <p className="serif-italic self-center text-xl leading-snug">
              &ldquo;{p.report.sketch.description}&rdquo;
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="panel overflow-hidden p-7" aria-labelledby="svo">
            <h3 id="svo" className="eyebrow">
              Screen vs outside
            </h3>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="h2 text-4xl" data-testid="screen-time">
                  {fmtDuration(p.screenMs)}
                </div>
                <div className="mt-1 text-xs text-fg-3">on Paper Trail</div>
              </div>
              <div>
                <div className="h2 text-4xl text-grass" data-testid="outside-time">
                  {p.outsideMs !== null ? fmtDuration(p.outsideMs) : "—"}
                </div>
                <div className="mt-1 text-xs text-fg-3">outside, phone at home</div>
              </div>
            </div>
            {pct !== null ? (
              <>
                <div
                  className="mt-6 flex h-1.5 overflow-hidden rounded-full bg-white/5"
                  role="img"
                  aria-label={`Screen was ${pct}% of the adventure`}
                >
                  <div className="bg-fg-2" style={{ width: `${pct}%` }} />
                  <div className="flex-1 bg-grass" />
                </div>
                <p className="h3 mt-4 text-xl">
                  Your screen was <span className="text-grass">{pct}%</span> of this adventure.
                </p>
              </>
            ) : (
              <p className="mt-5 text-sm text-fg-3">
                Print from Paper Trail next time and we&rsquo;ll time the outside part too.
              </p>
            )}
          </section>

          <section className="panel relative p-7" aria-labelledby="letter">
            <Mail size={18} strokeWidth={1.5} className="absolute right-6 top-7 text-fg-3" />
            <h3 id="letter" className="eyebrow">
              A note from The Trail Office
            </h3>
            <p className="serif-italic mt-4 whitespace-pre-line text-[1.15rem] leading-relaxed text-fg">
              {p.report.letter}
            </p>
          </section>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              className="btn btn-primary"
              onClick={p.onAddToBook}
              disabled={p.inBook}
              data-testid="add-to-book"
            >
              <BookOpen size={16} strokeWidth={1.7} />{" "}
              {p.inBook ? "In your Trail Book" : "Add to Trail Book"}
            </button>
            <Link href={`/postcard/${p.trailId}`} className="btn">
              Print a reply postcard
            </Link>
            <button
              type="button"
              className="btn"
              aria-pressed={sound}
              aria-label={sound ? "Stamp sound on" : "Stamp sound off"}
              onClick={() => {
                const n = !sound;
                setSound(n);
                saveSettings({ ...loadSettings(), sound: n });
                if (n) thump();
              }}
            >
              {sound ? (
                <Volume2 size={16} strokeWidth={1.6} />
              ) : (
                <VolumeX size={16} strokeWidth={1.6} />
              )}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
