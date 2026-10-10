import Link from "next/link";
import { ArrowRight, HardDrive, ShieldCheck, WifiOff } from "lucide-react";
import { Story } from "@/components/landing/Story";
import { Pages } from "@/components/landing/Pages";
import { Return } from "@/components/landing/Return";
import { Reveal } from "@/components/Reveal";
import { SmoothScroll } from "@/components/SmoothScroll";

const OPEN = [
  {
    icon: HardDrive,
    title: "Runs on Gemma",
    body: "An open model from Google. Run it on your own computer with Ollama, or use Ollama Cloud or the Gemini API.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing to sign up for",
    body: "No accounts and no tracking. Your trails are saved in this browser, not on a server.",
  },
  {
    icon: WifiOff,
    title: "Works without signal",
    body: "Once it's printed, it's paper. No battery, no notifications, no map app.",
  },
];

export default function Landing() {
  return (
    <>
      <SmoothScroll />
      <Story />
      <Pages />
      <Return />

      <section
        className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32"
        aria-labelledby="open-h"
      >
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Open by design</p>
          <h2 id="open-h" className="h2 mt-4 text-[clamp(2.1rem,1.3rem+2.6vw,3.5rem)]">
            Your street is nobody&rsquo;s data.
          </h2>
        </Reveal>
        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {OPEN.map(({ icon: Icon, title, body }, i) => (
            <Reveal as="li" key={title} delay={i * 0.08} className="panel p-7">
              <Icon size={22} strokeWidth={1.5} className="text-grass" />
              <h3 className="h3 mt-6 text-xl">{title}</h3>
              <p className="mt-2 leading-relaxed text-fg-2">{body}</p>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="relative overflow-hidden px-5 py-32 sm:py-44" aria-labelledby="cta-h">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(201,238,115,0.10),transparent_70%)]"
        />
        <Reveal className="relative mx-auto max-w-3xl text-center">
          <h2 id="cta-h" className="display text-[clamp(2.8rem,1.6rem+5vw,6rem)]">
            Print one <em className="text-grass">this weekend.</em>
          </h2>
          <p className="lede mx-auto mt-6 max-w-md">
            Pick a starting point and a time. It takes about a minute, and it&rsquo;s free.
          </p>
          <div className="mt-10 flex justify-center">
            <Link href="/new" className="btn btn-primary btn-lg">
              Make my trail <ArrowRight size={18} className="arrow" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
