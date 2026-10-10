"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { db, type TrailRecord } from "@/lib/client/db";
import { getConfig, type PublicConfig } from "@/lib/client/api";
import { fmtDuration, zineData } from "@/lib/client/trail";
import { ZineRack } from "@/components/ZineRack";

const edition = (t: TrailRecord) => `No. ${String(t.edition).padStart(3, "0")}`;
const href = (t: TrailRecord) => (t.report ? `/return/${t.id}` : `/trail/${t.id}`);

/** One line of the index: everything the shelf shows, as a link. */
function IndexRow({ t, screen }: { t: TrailRecord; screen: number }) {
  const date = new Date(t.returnedAt ?? t.createdAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <li>
      <Link
        href={href(t)}
        className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-5 gap-y-1 border-b border-line-2 py-5 sm:grid-cols-[5rem_1fr_auto_auto]"
        data-testid="book-card"
      >
        <span className="mono text-[0.78rem] text-ink-3">{edition(t)}</span>
        <span className="min-w-0">
          <span className="title block truncate text-[1.6rem] transition-colors group-hover:text-riso">
            {t.plan?.title ?? "Untitled trail"}
          </span>
          <span className="mt-0.5 block text-[0.86rem] text-ink-3">
            {t.location.label} · {date}
          </span>
        </span>
        <span className="mono hidden text-[0.74rem] text-ink-3 sm:block">
          {t.outsideMs
            ? `${fmtDuration(t.outsideMs)} outside · ${fmtDuration(screen)} screen`
            : `${fmtDuration(screen)} on screen`}
        </span>
        <span className="flex items-center gap-3">
          {t.stamp ? (
            <span className="stamp rotate-[-6deg] px-2 py-0.5 text-[0.62rem]">
              {t.stamp.points} pts
            </span>
          ) : (
            <span className="label !text-[0.62rem]">
              {t.printedAt ? "printed · not back yet" : "not printed"}
            </span>
          )}
          <ArrowUpRight
            size={18}
            className="text-ink-3 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
          />
        </span>
      </Link>
    </li>
  );
}

export default function TrailBook() {
  const router = useRouter();
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  useEffect(() => {
    void getConfig().then(setCfg);
  }, []);
  const data = useLiveQuery(async () => {
    const trails = await db().trails.orderBy("createdAt").reverse().toArray();
    const sessions = await db().sessions.toArray();
    const screen = new Map<string, number>();
    for (const s of sessions) screen.set(s.trailId, (screen.get(s.trailId) ?? 0) + s.ms);
    return { trails, screen };
  });
  const shelf = useMemo(() => data?.trails.filter((t) => t.inBook) ?? [], [data]);
  const rack = useMemo(
    () =>
      shelf
        .filter((t) => t.plan)
        .map((t) => ({
          id: t.id,
          data: zineData(t, cfg),
          title: t.plan?.title ?? "Trail",
          meta: `${edition(t)} · ${t.location.label}`,
          ...(t.stamp ? { points: t.stamp.points } : {}),
        })),
    [shelf, cfg],
  );

  if (!data)
    return <p className="mx-auto max-w-5xl px-6 pb-20 pt-40 text-ink-3">Opening the book…</p>;
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
    <div className="mx-auto max-w-7xl px-[var(--gutter)] pb-16 pt-32 sm:pt-40">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <p className="label folio">Kept in this browser only</p>
          <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,6.2rem)]">
            Trail <em className="text-riso">Book</em>
          </h1>
        </div>
        <p className="lede max-w-sm">
          Every sheet you bring home, stamped and shelved. Nothing here ever leaves this browser.
        </p>
      </div>

      <ul
        className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-line-2 sm:grid-cols-4"
        aria-label="Totals"
      >
        {stats.map((s) => (
          <li key={s.k} className="bg-bone p-6 sm:p-8">
            <p
              className="font-serif num text-[clamp(2.6rem,2rem+2vw,3.6rem)] leading-none"
              data-testid={`stat-${s.k.replace(/\s/g, "-")}`}
            >
              {s.v}
            </p>
            <p className="label mt-3">{s.k}</p>
          </li>
        ))}
      </ul>

      {shelf.length === 0 ? (
        <div className="mt-24 text-center">
          <div className="relative mx-auto h-28 max-w-md" aria-hidden>
            <div className="absolute inset-x-0 bottom-0 h-3 rounded-[3px] bg-[linear-gradient(180deg,#c99b6b,#a87a4c)] shadow-[0_18px_30px_-12px_rgb(21_20_18/0.45)]" />
            <div className="absolute bottom-3 left-1/2 h-20 w-14 -translate-x-1/2 -rotate-6 rounded-[2px] border border-dashed border-ink/25" />
          </div>
          <p className="headline mx-auto mt-10 max-w-xl text-[clamp(2rem,1.6rem+1.6vw,2.8rem)]">
            The shelf is empty.{" "}
            <em className="serif-em text-ink-3">
              The best things on it won&rsquo;t be on a screen.
            </em>
          </p>
          <Link href="/new" className="btn btn-riso btn-lg mt-10">
            Make my first trail
            <span className="knob" aria-hidden>
              <ArrowRight size={18} />
            </span>
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-16">
            <ZineRack
              zines={rack}
              onOpen={(id) => {
                const t = shelf.find((x) => x.id === id);
                if (t) router.push(href(t));
              }}
            />
          </div>
          <section className="mt-16" aria-labelledby="index-h">
            <h2 id="index-h" className="label folio">
              The index
            </h2>
            <ul className="mt-2" aria-label="Your trails">
              {shelf.map((t) => (
                <IndexRow key={t.id} t={t} screen={data.screen.get(t.id) ?? 0} />
              ))}
            </ul>
          </section>
        </>
      )}

      {others.length > 0 && (
        <section className="mt-20" aria-labelledby="out-h">
          <h2 id="out-h" className="title text-[2rem]">
            Still out there
          </h2>
          <ul className="mt-5 divide-y divide-line-2">
            {others.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <span className="text-ink-2">
                  <span className="mono mr-3 text-[0.78rem] text-ink-3">{edition(t)}</span>
                  {t.plan?.title ?? "Untitled"}
                </span>
                <span className="flex gap-2">
                  <Link className="btn btn-sheet btn-sm" href={`/trail/${t.id}`}>
                    Sheet
                  </Link>
                  <Link className="btn btn-ink btn-sm" href={`/return/${t.id}`}>
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
