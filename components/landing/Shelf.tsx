"use client";
import { useMemo, useState } from "react";
import { demoZines } from "@/lib/demo/demoZine";
import { Reveal } from "@/components/Reveal";
import { ZineRack } from "@/components/ZineRack";
import { BookletDialog } from "@/components/BookletDialog";

const POINTS = [140, 115, 95];

export function Shelf() {
  const zines = useMemo(() => demoZines(), []);
  const [open, setOpen] = useState<string | null>(null);
  const opened = zines.find((z) => z.id === open);
  const rack = zines.map((z, i) => ({
    id: z.id,
    data: z,
    title: z.plan?.title ?? "Trail",
    meta: `No. ${String(z.edition).padStart(3, "0")} · ${z.locationLabel}`,
    points: POINTS[i],
  }));
  return (
    <section aria-labelledby="shelf-h" className="relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto grid max-w-7xl gap-12 px-[var(--gutter)] lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <Reveal>
          <p className="label folio">The Trail Book</p>
          <h2 id="shelf-h" className="headline mt-6 text-[clamp(2.5rem,1.4rem+3.6vw,4.6rem)]">
            Every walk ends up <em className="serif-em text-riso">on the shelf.</em>
          </h2>
          <p className="lede mt-6 max-w-md">
            Read a sheet back and The Trail Office stamps it and files it in your Trail Book: a
            shelf of the places you&rsquo;ve walked, kept in this browser and nowhere else.
          </p>
          <ul className="mt-8 grid gap-2">
            {rack.map((z) => (
              <li key={z.id}>
                <button
                  type="button"
                  onClick={() => setOpen(z.id)}
                  className="group flex w-full items-baseline justify-between gap-4 border-b border-line-2 py-3 text-left"
                >
                  <span className="title text-[1.3rem] transition-colors group-hover:text-riso">
                    {z.title}
                  </span>
                  <span className="label shrink-0">Open the booklet</span>
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <ZineRack zines={rack} onOpen={setOpen} maxCols={3} />
        </Reveal>
      </div>
      {opened && <BookletDialog data={opened} onClose={() => setOpen(null)} />}
    </section>
  );
}
