"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight } from "lucide-react";
import { db, type TrailRecord } from "@/lib/client/db";
import { fmtDuration } from "@/lib/client/trail";

function BookCard({ t, screen, i }: { t: TrailRecord; screen: number; i: number }) {
  const date = new Date(t.returnedAt ?? t.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const tilt = [-2.5, 1.8, -1.2, 2.6, -2, 1.2][i % 6]!;
  return (
    <li className="stage">
      <Link
        href={t.report ? `/return/${t.id}` : `/trail/${t.id}`}
        className="group relative block transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] [transform-style:preserve-3d] hover:[transform:rotateY(-12deg)_rotateX(6deg)_translateY(-8px)]"
        style={{ transform: `rotate(${tilt}deg)` }}
        data-testid="book-card"
      >
        {/* A tiny folded zine: page edges behind the cover. */}
        <div
          className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-[2px] bg-paper-2 opacity-80"
          aria-hidden
        />
        <div
          className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-[2px] bg-[#e9e3d6]"
          aria-hidden
        />
        <div className="paper relative aspect-[0.66] overflow-hidden !rounded-[2px] p-4">
          <div
            className="absolute inset-2 rounded-[1px] shadow-[inset_0_0_0_1px_rgb(26_25_21/0.25)]"
            aria-hidden
          />
          <p className="mono relative text-[0.58rem] uppercase tracking-[0.12em] text-paper-mute">
            No. {String(t.edition).padStart(3, "0")} · {date}
          </p>
          <h2 className="h3 relative mt-3 text-[1.05rem] leading-tight text-paper-ink">
            {t.plan?.title ?? "Untitled trail"}
          </h2>
          <p className="relative mt-1 text-[0.68rem] text-paper-mute">{t.location.label}</p>
          {t.sketchThumb && (
            <img
              src={t.sketchThumb}
              alt=""
              className="relative mx-auto mt-3 h-20 w-auto opacity-80 mix-blend-multiply"
            />
          )}
          {t.stamp ? (
            <div className="stamp absolute bottom-4 right-3 rotate-[-10deg] px-2 py-1 text-center text-[0.55rem]">
              <div className="h3 text-base normal-case tracking-normal">{t.stamp.points} pts</div>
              walked
            </div>
          ) : (
            <p className="mono absolute bottom-4 left-4 text-[0.58rem] text-paper-mute">
              {t.printedAt ? "printed · not back yet" : "not printed"}
            </p>
          )}
        </div>
        <p className="mono mt-4 text-center text-[0.65rem] text-fg-3">
          {t.outsideMs
            ? `${fmtDuration(t.outsideMs)} outside · ${fmtDuration(screen)} screen`
            : `${fmtDuration(screen)} on screen`}
        </p>
      </Link>
    </li>
  );
}

export default function TrailBook() {
  const data = useLiveQuery(async () => {
    const trails = await db().trails.orderBy("createdAt").reverse().toArray();
    const sessions = await db().sessions.toArray();
    const screen = new Map<string, number>();
    for (const s of sessions) screen.set(s.trailId, (screen.get(s.trailId) ?? 0) + s.ms);
    return { trails, screen };
  });
  if (!data)
    return <p className="mx-auto max-w-5xl px-6 pb-20 pt-40 text-fg-3">Opening the book…</p>;
  const shelf = data.trails.filter((t) => t.inBook);
  const others = data.trails.filter((t) => !t.inBook);
  const walked = shelf.filter((t) => t.report);
  const spied = walked.reduce((s, t) => s + (t.score?.spotted ?? 0), 0);
  const outside = walked.reduce((s, t) => s + (t.outsideMs ?? 0), 0);
  const screen = walked.reduce((s, t) => s + (data.screen.get(t.id) ?? 0), 0);
  const pct = outside ? Math.round((screen / (screen + outside)) * 100) : null;
  const stats = [
    { k: "trails walked", v: String(walked.length) },
    { k: "things spied", v: String(spied) },
    { k: "outside", v: fmtDuration(outside) },
    { k: "screen share", v: pct === null ? "—" : `${pct}%` },
  ];
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-8 sm:pt-36">
      <p className="eyebrow">Saved in this browser only</p>
      <h1 className="display mt-4 text-[clamp(2.6rem,1.6rem+3.6vw,4.6rem)]">
        Trail <em className="text-grass">Book</em>
      </h1>
      <ul
        className="panel mt-12 grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x"
        aria-label="Totals"
      >
        {stats.map((s) => (
          <li key={s.k} className="p-6">
            <p className="h2 text-4xl" data-testid={`stat-${s.k.replace(/\s/g, "-")}`}>
              {s.v}
            </p>
            <p className="mt-2 text-xs text-fg-3">{s.k}</p>
          </li>
        ))}
      </ul>
      {shelf.length === 0 ? (
        <div className="mt-24 text-center">
          <p className="h2 mx-auto max-w-lg text-3xl text-fg-2">
            Your Trail Book is empty. The best things in it won&rsquo;t be on this screen.
          </p>
          <Link href="/new" className="btn btn-primary btn-lg mt-10">
            Make my first trail <ArrowRight size={18} className="arrow" />
          </Link>
        </div>
      ) : (
        <>
          <ul
            className="mt-16 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-5"
            aria-label="Your trails"
          >
            {shelf.map((t, i) => (
              <BookCard key={t.id} t={t} screen={data.screen.get(t.id) ?? 0} i={i} />
            ))}
          </ul>
          <div
            className="mt-8 h-2 rounded-full bg-gradient-to-b from-[#3a3428] to-[#24201a] shadow-[0_18px_30px_-10px_rgb(0_0_0/.8)]"
            aria-hidden
          />
        </>
      )}
      {others.length > 0 && (
        <section className="mt-20">
          <h2 className="h3 text-2xl">Still out there</h2>
          <ul className="mt-5 divide-y divide-line">
            {others.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
              >
                <span className="text-fg-2">
                  <span className="mono mr-3 text-xs text-fg-3">
                    No. {String(t.edition).padStart(3, "0")}
                  </span>
                  {t.plan?.title ?? "Untitled"}
                </span>
                <span className="flex gap-2">
                  <Link className="btn btn-sm" href={`/trail/${t.id}`}>
                    Sheet
                  </Link>
                  <Link className="btn btn-primary btn-sm" href={`/return/${t.id}`}>
                    I&rsquo;m back
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
