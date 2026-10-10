import Link from "next/link";
import { FoldingZine } from "@/components/FoldingZine";
import { Icon3D, type Icon3DName } from "@/components/Icon3D";
import { ModelBadge } from "@/components/ModelBadge";

const STEPS: { icon: Icon3DName; title: string; body: string; tone: string }[] = [
  {
    icon: "printer",
    title: "Fold",
    body: "Gemma reads the real map around you and writes an 8-page zine: a hand-drawn map, I-Spy, a riddle, a sketch box.",
    tone: "bg-[#ffe3ec]",
  },
  {
    icon: "phone-off",
    title: "Leave",
    body: "Print it, one cut, fold. Put your phone face-down. The paper knows the way.",
    tone: "bg-[#dff1ef]",
  },
  {
    icon: "pencil",
    title: "Walk",
    body: "Tick what you spy. Listen for 60 seconds. Draw the strangest tree. No screen required.",
    tone: "bg-[#fff1cf]",
  },
  {
    icon: "camera",
    title: "Come home",
    body: "One photo of the scribbled sheet. Gemma reads your ticks, handwriting and sketch, and stamps your Trail Book.",
    tone: "bg-[#ece6ff]",
  },
];

export default function Landing() {
  return (
    <div className="overflow-x-clip">
      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-6 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pt-12">
        <div className="relative z-10">
          <p className="kicker mb-4">Hacktoberfest · Touch Grass · an open-model zine press</p>
          <h1 className="display riso text-[clamp(2.3rem,5.2vw,4.3rem)]">
            Every touch-grass app wants to come with you.
            <span className="mt-3 block text-rose [text-shadow:none]">This one stays home.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/80">
            Paper Trail turns your real neighbourhood into a one-sheet, 8-page paper zine written by
            an open model — so your phone can stay home. When you’re back, Gemma reads your pencil
            ticks, handwriting and sketches from one photo.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/new" className="btn btn-primary btn-xl">
              <Icon3D name="footprints" size={28} /> Make my trail
            </Link>
            <Link href="/book" className="btn">
              <Icon3D name="book" size={22} /> Trail Book
            </Link>
          </div>
          <div className="mt-6">
            <ModelBadge />
          </div>
        </div>
        <div className="relative">
          <Icon3D
            name="leaf"
            size={72}
            float
            tilt={-14}
            className="absolute -left-2 top-2 z-20 hidden sm:block"
          />
          <Icon3D
            name="pencil"
            size={78}
            float
            tilt={12}
            className="float-delay-1 absolute -right-1 top-10 z-20"
          />
          <Icon3D
            name="seedling"
            size={64}
            float
            tilt={-8}
            className="float-delay-2 absolute bottom-6 left-6 z-20"
          />
          <Icon3D
            name="scissors"
            size={60}
            float
            tilt={10}
            className="float-delay-3 float-slow absolute -bottom-2 right-10 z-20 hidden sm:block"
          />
          <div className="px-8 sm:px-0">
            <FoldingZine />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="display text-3xl sm:text-4xl">
          The screen is the <span className="text-rose">shortest</span> part.
        </h2>
        <p className="mt-3 max-w-2xl text-ink/75">
          And we prove it: every trail ends with a <strong>Screen vs Outside</strong> counter.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="card group relative p-5 pt-14 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.6deg]"
            >
              <div
                className={`absolute -top-9 left-5 grid h-20 w-20 place-items-center rounded-2xl border-2 border-ink ${s.tone} shadow-[4px_4px_0_var(--color-ink)]`}
              >
                <Icon3D
                  name={s.icon}
                  size={56}
                  className="transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6"
                />
              </div>
              <p className="mono text-xs text-muted">0{i + 1}</p>
              <h3 className="display text-2xl">{s.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/80">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div
          className="card relative overflow-hidden bg-ink p-7 text-paper sm:p-10"
          style={{ boxShadow: "8px 8px 0 var(--color-pink)" }}
        >
          <Icon3D
            name="lock"
            size={88}
            float
            tilt={8}
            className="absolute right-6 top-6 hidden opacity-95 sm:block"
          />
          <p className="kicker !text-paper/60">Why an open model</p>
          <h2 className="display mt-2 max-w-2xl text-3xl sm:text-4xl">
            Your street and your handwriting never leave your machine.
          </h2>
          <ul className="mt-6 grid max-w-3xl gap-3 text-paper/85 sm:grid-cols-2">
            <li>• Gemma 4 runs locally through Ollama — no closed API anywhere.</li>
            <li>• It works offline after printing. It’s paper.</li>
            <li>• Swap E2B ↔ E4B with one env var.</li>
            <li>• Apache-2.0 weights: free for any school or scout group.</li>
          </ul>
          <Link href="/why-open" className="btn btn-sm mt-7 !bg-paper">
            Read why →
          </Link>
        </div>
      </section>
    </div>
  );
}
