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
  correct: { label: "Right!", cls: "bg-moss text-white" },
  close: { label: "Close", cls: "bg-[#f4e8cf] text-amber" },
  incorrect: { label: "Not quite", cls: "bg-bone-2 text-ink-2" },
  blank: { label: "Left blank", cls: "bg-bone-2 text-ink-2" },
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
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* The report itself, on letterhead from The Trail Office. */}
        <section
          className="paper relative overflow-hidden !rounded-[6px] p-7 sm:p-11"
          aria-labelledby="report-title"
        >
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-md">
              <p className="label">The Trail Office · Field report · {dateStr}</p>
              <h2
                id="report-title"
                className="headline mt-4 text-[clamp(2.3rem,1.5rem+2.6vw,3.6rem)]"
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
                  <div className="my-1 font-serif text-[1.9rem] normal-case leading-none tracking-normal">
                    {s.total} pts
                  </div>
                  <div className="text-[0.6rem]">{dateStr} · walked</div>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex items-end gap-4">
            <span className="display num text-[6.5rem] leading-[0.8]" data-testid="score">
              {s.total}
            </span>
            <span className="pb-1 text-[0.95rem] text-ink-2">
              points
              <br />
              spotted {s.spotted} of {s.of}
            </span>
          </div>

          <Heading>I-Spy</Heading>
          <p className="mt-1 text-[0.82rem] text-ink-3">
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
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.92rem] transition-colors duration-300 ${it.unsure ? "bg-[#f4e8cf]" : "bg-bone/70 hover:bg-bone-2"} ${it.spotted ? "text-ink" : "text-ink-3"}`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors duration-300 ${it.spotted ? "bg-riso text-white" : "shadow-[inset_0_0_0_1.5px_rgb(21_20_18/0.3)]"}`}
                    aria-hidden
                  >
                    {it.spotted && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 font-medium">
                    {p.labels[it.index] ?? `Item ${it.index + 1}`}
                  </span>
                  <span className="mono num text-xs">{p.points[it.index] ?? 0}</span>
                  {p.debug && (
                    <span className="mono text-[0.6rem]">
                      g:{it.gemma === null || it.gemma === undefined ? "–" : it.gemma ? "✓" : "✗"}{" "}
                      omr:{it.omrInk?.toFixed(3) ?? "–"} {it.source}{" "}
                      {Math.round(it.confidence * 100)}%
                    </span>
                  )}
                  {!p.debug && it.unsure && (
                    <span className="mono text-[0.6rem] text-amber">check</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <Heading>What you heard</Heading>
          <dl className="mt-3 grid gap-4">
            {listen.map(([k, val]) => (
              <div key={k} className="border-b border-dashed border-line-2 pb-2">
                <dt className="text-[0.8rem] text-ink-3">{k}</dt>
                <dd
                  className={`hand text-[1.8rem] leading-tight ${val ? "text-ink" : "text-ink-3"}`}
                >
                  {val ?? "(left blank)"}
                </dd>
              </div>
            ))}
          </dl>

          <Heading>The riddle</Heading>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="hand text-[1.8rem] leading-tight">
              {p.report.riddle.written ?? "—"}
            </span>
            <span
              className={`mono rounded-full px-3 py-1 text-xs font-medium ${v.cls}`}
              data-testid="verdict"
            >
              {v.label}
            </span>
          </div>
          <p className="mt-1 text-[0.92rem] text-ink-2">{p.report.riddle.note}</p>

          <Heading>Your sketch</Heading>
          <div className="mt-3 flex flex-col gap-5 sm:flex-row">
            {p.sketchSrc && (
              <img
                src={p.sketchSrc}
                alt="Your sketch, as photographed"
                className="h-40 w-auto self-start rounded-[3px] bg-white object-contain shadow-[0_0_0_1px_rgb(21_20_18/0.1),0_10px_20px_-12px_rgb(21_20_18/0.4)]"
              />
            )}
            <p className="self-center font-serif text-[1.55rem] italic leading-snug">
              &ldquo;{p.report.sketch.description}&rdquo;
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section
            data-surface="dark"
            className="relative overflow-hidden rounded-[22px] bg-dark p-7 text-dark-fg"
            aria-labelledby="svo"
          >
            <h3 id="svo" className="label !text-dark-fg-2">
              Screen vs outside
            </h3>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <div className="font-serif text-[2.8rem] leading-none" data-testid="screen-time">
                  {fmtDuration(p.screenMs)}
                </div>
                <div className="mt-2 text-xs text-dark-fg-2">on Paper Trail</div>
              </div>
              <div>
                <div
                  className="font-serif text-[2.8rem] leading-none text-safelight"
                  data-testid="outside-time"
                >
                  {p.outsideMs !== null ? fmtDuration(p.outsideMs) : "—"}
                </div>
                <div className="mt-2 text-xs text-dark-fg-2">outside, phone at home</div>
              </div>
            </div>
            {pct !== null ? (
              <>
                <div
                  className="mt-7 flex h-1.5 overflow-hidden rounded-full bg-white/10"
                  role="img"
                  aria-label={`Screen was ${pct}% of the adventure`}
                >
                  <div className="bg-dark-fg-2" style={{ width: `${pct}%` }} />
                  <div className="flex-1 bg-safelight" />
                </div>
                <p className="title mt-5 text-[1.45rem]">
                  Your screen was <span className="text-safelight">{pct}%</span> of this adventure.
                </p>
              </>
            ) : (
              <p className="mt-6 text-[0.9rem] text-dark-fg-2">
                Print from Paper Trail next time and we&rsquo;ll time the outside part too.
              </p>
            )}
          </section>

          <section className="card relative overflow-hidden p-7" aria-labelledby="letter">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(135deg,#c8402a_0_10px,transparent_10px_20px,#2b3dd8_20px_30px,transparent_30px_40px)] opacity-70"
            />
            <Mail size={18} strokeWidth={1.5} className="absolute right-6 top-7 text-ink-3" />
            <h3 id="letter" className="label">
              A note from The Trail Office
            </h3>
            <p className="mt-5 whitespace-pre-line font-serif text-[1.3rem] italic leading-relaxed">
              {p.report.letter}
            </p>
          </section>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              className="btn btn-riso"
              onClick={p.onAddToBook}
              disabled={p.inBook}
              data-testid="add-to-book"
            >
              <BookOpen size={16} strokeWidth={1.7} />{" "}
              {p.inBook ? "In your Trail Book" : "Add to Trail Book"}
            </button>
            <Link href={`/postcard/${p.trailId}`} className="btn btn-sheet">
              Print a reply postcard
            </Link>
            <button
              type="button"
              className="btn btn-sheet btn-icon"
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

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="label folio mt-11">{children}</h3>;
}
