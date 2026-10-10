import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Studio } from "@/components/landing/Studio";
import { Pages } from "@/components/landing/Pages";
import { How } from "@/components/landing/How";
import { Darkroom } from "@/components/landing/Darkroom";
import { Shelf } from "@/components/landing/Shelf";
import { Reveal } from "@/components/Reveal";
import { SmoothScroll } from "@/components/SmoothScroll";

/** Real things from the three example trails, as they'd appear on an I-Spy page. */
const SPOTTED = [
  "a golden hydrant",
  "a bench with a view",
  "the red library",
  "a heron by the pond",
  "a mural with a face in it",
  "the rose garden",
  "the farthest thing you can see",
  "a post box",
  "the bandstand",
  "a palm tree, waving",
];

const PRINCIPLES = [
  {
    n: "01",
    title: "An open model",
    body: "Gemma’s weights are public. Run it on your own computer with Ollama, or use Ollama Cloud or Google’s Gemini API if you’d rather not install anything.",
  },
  {
    n: "02",
    title: "No account, no tracking",
    body: "There’s nothing to sign up for. Your trails, photos and Field Reports are kept in this browser, not on a server.",
  },
  {
    n: "03",
    title: "Paper needs no signal",
    body: "Once it’s printed it works anywhere: in a park with no bars, with a flat battery, in light rain if you’re careful.",
  },
];

function Marquee() {
  const row = [...SPOTTED, ...SPOTTED];
  return (
    <div
      className="relative overflow-hidden border-y border-line-2 py-6"
      aria-label="Things to spot on real trails"
    >
      <ul className="marquee">
        {row.map((s, i) => (
          <li
            key={i}
            aria-hidden={i >= SPOTTED.length}
            className="flex shrink-0 items-center gap-8 pr-8 font-serif text-[clamp(1.6rem,1.2rem+1.4vw,2.6rem)] italic leading-none"
          >
            {s}
            <span className="inline-block h-2.5 w-2.5 rotate-45 bg-riso" aria-hidden />
          </li>
        ))}
      </ul>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bone to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bone to-transparent"
      />
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <SmoothScroll />
      <Studio />
      <Marquee />
      <Pages />
      <How />
      <Darkroom />
      <Shelf />

      <section
        aria-labelledby="open-h"
        className="relative mx-auto max-w-7xl px-[var(--gutter)] py-28 sm:py-36"
      >
        <Reveal className="grid gap-8 md:grid-cols-2 md:items-end">
          <div>
            <p className="label folio">Open by design</p>
            <h2 id="open-h" className="headline mt-6 text-[clamp(2.5rem,1.4rem+3.6vw,4.6rem)]">
              Your street is <em className="serif-em text-riso">nobody&rsquo;s business.</em>
            </h2>
          </div>
          <p className="lede max-w-md md:justify-self-end">
            Paper Trail sees a map of where you live and a photo of your handwriting. So it runs on
            an open model, keeps nothing on a server and asks you for nothing.
          </p>
        </Reveal>
        <ul className="mt-16 grid gap-px overflow-hidden rounded-[22px] bg-line-2 md:grid-cols-3">
          {PRINCIPLES.map(({ n, title, body }, i) => (
            <Reveal as="li" key={n} delay={i * 0.08} className="bg-bone p-8 sm:p-10">
              <span className="mono text-[0.78rem] text-riso">{n}</span>
              <h3 className="title mt-10 text-[1.9rem]">{title}</h3>
              <p className="mt-3 leading-relaxed text-ink-2">{body}</p>
            </Reveal>
          ))}
        </ul>
        <p className="mt-8">
          <Link
            href="/why-open"
            className="link inline-flex items-center gap-1.5 text-ink-2 hover:text-ink"
          >
            Why an open model <ArrowUpRight size={16} />
          </Link>
        </p>
      </section>

      <section
        className="relative overflow-hidden px-[var(--gutter)] pb-16 pt-20 sm:pt-28"
        aria-labelledby="cta-h"
      >
        <Reveal className="relative mx-auto max-w-5xl text-center">
          <p className="label">Free · about a minute · any printer</p>
          <h2 id="cta-h" className="display mt-8 text-[clamp(3.2rem,1.6rem+7vw,8rem)]">
            The best part happens <em className="text-riso">off screen.</em>
          </h2>
          <p className="lede mx-auto mt-8 max-w-md">
            Pick a starting point and a length. We&rsquo;ll draw the map and write the pages. You
            bring a pencil.
          </p>
          <div className="mt-10 flex justify-center">
            <Link href="/new" className="btn btn-riso btn-lg">
              Make my trail
              <span className="knob" aria-hidden>
                <ArrowRight size={18} />
              </span>
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
