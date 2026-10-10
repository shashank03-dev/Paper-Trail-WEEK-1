import { HardDrive, KeyRound, Map, Printer, RefreshCw } from "lucide-react";
import { Reveal } from "@/components/Reveal";

export const metadata = { title: "Why an open model — Paper Trail" };

const POINTS = [
  {
    icon: HardDrive,
    title: "It can run on your own computer",
    body: "Paper Trail reads a map of where you live and a photo of your handwriting. With Gemma running in Ollama on your machine, neither leaves it. If you'd rather not install anything, the same open model also runs on Ollama Cloud or Google's Gemini API.",
  },
  {
    icon: Printer,
    title: "It works offline once printed",
    body: "After printing, the walk needs no network at all. It's paper. Demo mode even works without internet, using saved maps and recorded answers (clearly labelled as a replay).",
  },
  {
    icon: RefreshCw,
    title: "You can swap the model",
    body: "Change one setting to move between Gemma sizes, or between your laptop and the cloud. The project includes tests that measure what each swap costs in accuracy and speed.",
  },
  {
    icon: KeyRound,
    title: "Anyone can run it for free",
    body: "Gemma's weights are licensed so that a school, a library or a scout group can print thirty trails on their own hardware, without anyone's API key.",
  },
  {
    icon: Map,
    title: "Why it matters here",
    body: "This is an app about leaving the screen behind. It felt wrong to send a map of your street and a picture of your notes to a closed model every time you go for a walk.",
  },
];

export default function WhyOpen() {
  return (
    <div className="mx-auto max-w-4xl px-[var(--gutter)] pb-16 pt-32 sm:pt-40">
      <p className="label folio">Open by design</p>
      <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,6rem)]">
        Why an <em className="text-riso">open</em> model?
      </h1>
      <ul className="mt-14 grid gap-4">
        {POINTS.map(({ icon: Icon, title, body }, i) => (
          <Reveal as="li" key={title} delay={i * 0.05} className="card flex gap-6 p-7 sm:p-9">
            <Icon size={22} strokeWidth={1.5} className="mt-1 shrink-0 text-riso" />
            <div>
              <h2 className="title text-[2rem]">{title}</h2>
              <p className="mt-2 leading-relaxed text-ink-2">{body}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
