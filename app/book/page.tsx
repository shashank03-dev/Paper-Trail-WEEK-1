"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Icon3D } from "@/components/Icon3D";
import { db, type TrailRecord } from "@/lib/client/db";
import { fmtDuration } from "@/lib/client/trail";

function BookCard({ t, screen, i }: { t: TrailRecord; screen: number; i: number }) {
  const date = new Date(t.returnedAt ?? t.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const tilt = [-3, 2, -1.5, 3, -2.5, 1.5][i % 6]!;
  return (
    <li className="stage">
      <Link
        href={t.report ? `/return/${t.id}` : `/trail/${t.id}`}
        className="group relative block transition-transform duration-500 [transform-style:preserve-3d] hover:[transform:rotateY(-14deg)_rotateX(6deg)_translateZ(20px)]"
        style={{ transform: `rotate(${tilt}deg)` }}
        data-testid="book-card"
      >
        {/* A tiny folded zine: page edges behind the cover. */}
        <div
          className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-sm bg-[#efe6d4] shadow-[var(--shadow-paper)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-sm bg-[#f7f0e2]"
          aria-hidden
        />
        <div className="relative aspect-[0.66] overflow-hidden rounded-sm border border-ink/10 bg-card p-4 shadow-[var(--shadow-paper)]">
          <div className="absolute inset-2 border-2 border-pink/70" aria-hidden />
          <p className="mono relative text-[0.6rem]">
            No. {String(t.edition).padStart(3, "0")} · {date}
          </p>
          <h2 className="display relative mt-3 text-lg leading-tight">
            {t.plan?.title ?? "Untitled trail"}
          </h2>
          <p className="relative mt-1 text-[0.7rem] text-muted">{t.location.label}</p>
          {t.sketchThumb && (
            <img
              src={t.sketchThumb}
              alt=""
              className="relative mx-auto mt-3 h-20 w-auto opacity-80 mix-blend-multiply"
            />
          )}
          {t.stamp ? (
            <div className="stamp absolute bottom-4 right-3 rotate-[-10deg] px-2 py-1 text-center text-[0.55rem]">
              <div className="display text-base normal-case tracking-normal">
                {t.stamp.points} pts
              </div>
              walked
            </div>
          ) : (
            <p className="mono absolute bottom-4 left-4 text-[0.6rem] text-muted">
              {t.printedAt ? "printed · not back yet" : "not printed"}
            </p>
          )}
        </div>
        <p className="mono mt-3 text-center text-[0.65rem] text-muted">
          {t.outsideMs
            ? `${fmtDuration(t.outsideMs)} outside · ${fmtDuration(screen)} screen`
            : `${fmtDuration(screen)} screen`}
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
  if (!data) return <p className="mx-auto max-w-5xl px-6 py-20 text-muted">Opening the book…</p>;
  const shelf = data.trails.filter((t) => t.inBook);
  const others = data.trails.filter((t) => !t.inBook);
  const walked = shelf.filter((t) => t.report);
  const spied = walked.reduce((s, t) => s + (t.score?.spotted ?? 0), 0);
  const outside = walked.reduce((s, t) => s + (t.outsideMs ?? 0), 0);
  const screen = walked.reduce((s, t) => s + (data.screen.get(t.id) ?? 0), 0);
  const pct = outside ? Math.round((screen / (screen + outside)) * 100) : null;
  const stats = [
    { k: "trails walked", v: String(walked.length), icon: "footprints" as const },
    { k: "things spied", v: String(spied), icon: "magnifier" as const },
    { k: "outside", v: fmtDuration(outside), icon: "tree" as const },
    { k: "screen share", v: pct === null ? "—" : `${pct}%`, icon: "laptop" as const },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:px-6">
      <p className="kicker">Kept in this browser only</p>
      <h1 className="display riso mt-1 text-4xl sm:text-5xl">Trail Book</h1>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Totals">
        {stats.map((s) => (
          <li key={s.k} className="card flex items-center gap-3 p-4">
            <Icon3D name={s.icon} size={40} />
            <div>
              <p className="display text-2xl" data-testid={`stat-${s.k.replace(/\s/g, "-")}`}>
                {s.v}
              </p>
              <p className="text-xs text-muted">{s.k}</p>
            </div>
          </li>
        ))}
      </ul>
      {shelf.length === 0 ? (
        <div className="mt-16 grid place-items-center text-center">
          <Icon3D name="book" size={110} float tilt={-6} />
          <p className="display mt-6 max-w-md text-2xl">
            Your Trail Book is empty. The best things in it won&rsquo;t be on this screen.
          </p>
          <Link href="/new" className="btn btn-primary mt-6">
            Make my first trail
          </Link>
        </div>
      ) : (
        <ul
          className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Your trails"
        >
          {shelf.map((t, i) => (
            <BookCard key={t.id} t={t} screen={data.screen.get(t.id) ?? 0} i={i} />
          ))}
        </ul>
      )}
      {shelf.length > 0 && (
        <div
          className="mt-6 h-3 rounded-full bg-gradient-to-b from-[#c9b994] to-[#a99671] shadow-[0_10px_20px_-8px_rgb(60_40_10/.5)]"
          aria-hidden
        />
      )}
      {others.length > 0 && (
        <section className="mt-16">
          <h2 className="display text-2xl">Still out there</h2>
          <ul className="mt-4 divide-y-2 divide-dashed divide-line">
            {others.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="mono text-xs text-muted">
                    No. {String(t.edition).padStart(3, "0")}
                  </span>{" "}
                  {t.plan?.title ?? "Untitled"}
                </span>
                <span className="flex gap-2">
                  <Link className="btn btn-sm" href={`/trail/${t.id}`}>
                    Sheet
                  </Link>
                  <Link className="btn btn-sm btn-teal" href={`/return/${t.id}`}>
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
