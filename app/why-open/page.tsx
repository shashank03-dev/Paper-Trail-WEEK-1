import { Icon3D, type Icon3DName } from "@/components/Icon3D";

export const metadata = { title: "Why open models? — Paper Trail" };

const POINTS: { icon: Icon3DName; title: string; body: string }[] = [
  {
    icon: "lock",
    title: "Privacy",
    body: "Paper Trail reads a map of where you live and a photo of your handwriting. With Gemma running in Ollama on your own machine, neither leaves it. There are no accounts, no analytics, and your trail history lives in this browser’s IndexedDB.",
  },
  {
    icon: "printer",
    title: "Offline",
    body: "Once the sheet is printed, the adventure needs no network at all. It’s paper. Demo mode even works with no internet, using cached map data and recorded model output (clearly labelled as a replay).",
  },
  {
    icon: "gear",
    title: "Swap the model",
    body: "Change one env var to move between gemma4:e2b and gemma4:e4b, or any open-weights model your endpoint serves. The repo includes an eval harness so you can measure what the swap costs in accuracy and speed.",
  },
  {
    icon: "book",
    title: "Apache 2.0",
    body: "Gemma’s weights are licensed for anyone to run. A school, a library or a scout group can print 30 trails for free, on their own hardware, without anyone’s API key.",
  },
  {
    icon: "map",
    title: "Why not a closed API?",
    body: "A closed API would mean sending a map of your neighbourhood and a picture of your notes to someone else’s server for every walk. For a tool whose whole point is leaving the screen behind, that felt wrong.",
  },
];

export default function WhyOpen() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-2 sm:px-6">
      <p className="kicker">Open innovation</p>
      <h1 className="display riso mt-1 text-4xl sm:text-5xl">Why open models?</h1>
      <ul className="mt-10 grid gap-6">
        {POINTS.map((p) => (
          <li key={p.title} className="card flex gap-5 p-6">
            <Icon3D name={p.icon} size={56} className="shrink-0" />
            <div>
              <h2 className="display text-2xl">{p.title}</h2>
              <p className="mt-2 leading-relaxed text-ink/80">{p.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
