import type {
  BackCopy,
  CoverCopy,
  IspyItem,
  ListenCopy,
  Riddle,
  RouteCopy,
  TrailPlan,
  WriterContext,
} from "@/lib/schemas";
import { fitsEverywhere } from "@/lib/zine/boxes";

export const MIN_GROUNDED = 6;

/** Internal ids from the prompt: OSM-style feature ids (n123…, w123…, r123…) and waypoint tags (W1…). */
const ID_RE = /\b(?:[nwr]\d{4,}|W\d{1,2})\b/g;

/**
 * Copy that will be printed must never show the ids we use to ground the
 * model ("the fountain n9000024", "at W6"); names and descriptions only.
 */
export function idLeaks(texts: (string | undefined)[]): string[] {
  const found = new Set<string>();
  for (const t of texts) for (const m of (t ?? "").matchAll(ID_RE)) found.add(m[0]);
  return found.size
    ? [
        `the text mentions internal ids (${[...found].join(", ")}); never print ids, describe each place in words or by its name`,
      ]
    : [];
}

/**
 * Gemma often echoes the prompt's ids in printed copy ("head to W3", "the
 * fountain (n9000024)"). Each has an obvious wording, so swap it in rather
 * than spend a whole retry: waypoint tags become the stop numbers printed on
 * the map, and a known feature id becomes the place's name (or kind). Ids we
 * never gave the model are left for `idLeaks` to reject.
 */
export function scrubIds(text: string, ctx: Pick<WriterContext, "features">): string {
  const byId = new Map(ctx.features.map((f) => [f.id, f]));
  const startsSentence = (before: string) => /(^|[.!?]["')]?\s+)$/.test(before);
  return (
    text
      .replace(/\bW(\d{1,2})\b/g, (_, n: string, at: number) =>
        startsSentence(text.slice(0, at)) ? `Stop ${n}` : `stop ${n}`,
      )
      // "(n123)" next to a name or description adds nothing.
      .replace(/\s*[([]\s*(?:id:?\s*)?([nwr]\d{4,})\s*[)\]]/g, (m, id: string) =>
        byId.has(id) ? "" : m,
      )
      .replace(/(\s*)\b([nwr]\d{4,})\b/g, (m, sp: string, id: string, at: number, all: string) => {
        const f = byId.get(id);
        if (!f) return m;
        const kind = f.kind.replace(/_/g, " ");
        const before = all.slice(0, at).toLowerCase();
        // "the fountain n123" or "Rose Garden n123": the words are already there.
        if (before.endsWith(kind) || (f.name && before.endsWith(f.name.toLowerCase()))) return "";
        const words = f.name ?? `the ${kind}`;
        return (
          sp +
          (startsSentence(all.slice(0, at) + sp) ? words[0]!.toUpperCase() + words.slice(1) : words)
        );
      })
  );
}

/** Words that suggest a place name we were never given. */
const PLACE_WORDS =
  /\b(street|st\.|road|rd\.|avenue|ave|lane|statue|cafe|café|bakery|shop|church|museum|library|fountain|park|square|bridge)\b/i;

export function ispyProblems(items: IspyItem[], ctx: WriterContext): string[] {
  const ids = new Set(ctx.features.map((f) => f.id));
  const p: string[] = [];
  const bad = items.filter((i) => i.featureId !== null && !ids.has(i.featureId));
  if (bad.length)
    p.push(
      `ispy featureIds not in the list: ${bad.map((b) => b.featureId).join(", ")} (use an id from the lists or null)`,
    );
  const grounded = items.filter((i) => i.featureId !== null && ids.has(i.featureId)).length;
  if (grounded < MIN_GROUNDED)
    p.push(
      `only ${grounded} I-Spy items are grounded; at least ${MIN_GROUNDED} need a featureId from the lists`,
    );
  p.push(...idLeaks(items.flatMap((i) => [i.label, i.hint])));
  const labels = new Set<string>();
  for (const it of items) {
    const key = it.label.toLowerCase();
    if (labels.has(key)) p.push(`duplicate I-Spy label "${it.label}"`);
    labels.add(key);
    if (!fitsEverywhere("ispyLabel", it.label, { ispyCount: items.length }))
      p.push(`I-Spy label too long to fit: "${it.label}"`);
  }
  return p;
}

export function riddleProblems(r: Riddle, ctx: WriterContext): string[] {
  const wp = new Set(ctx.route.waypoints.map((w) => w.featureId));
  const p: string[] = [];
  if (!wp.has(r.targetFeatureId))
    p.push(
      `riddle targetFeatureId "${r.targetFeatureId}" must be one of the WAYPOINT ids: ${[...wp].join(", ")}`,
    );
  p.push(...idLeaks([r.text]));
  if (!fitsEverywhere("riddleText", r.text))
    p.push("riddle text is too long for its panel; make it shorter");
  return p;
}

export function planProblems(plan: TrailPlan, ctx: WriterContext): string[] {
  const p = [...ispyProblems(plan.ispy, ctx), ...riddleProblems(plan.riddle, ctx)];
  if (plan.listenStop > ctx.route.waypoints.length)
    p.push(`listenStop must be 1..${ctx.route.waypoints.length}`);
  p.push(...idLeaks([plan.title, plan.subtitle, plan.sketchPrompt]));
  if (!fitsEverywhere("coverTitle", plan.title)) p.push("title too long for the cover");
  if (!fitsEverywhere("sketchPrompt", plan.sketchPrompt)) p.push("sketchPrompt too long");
  return p;
}

export function routeCopyProblems(c: RouteCopy, ctx: WriterContext): string[] {
  const p: string[] = [];
  const n = ctx.route.waypoints.length;
  const ids = new Set(ctx.features.map((f) => f.id));
  const stops = new Set(c.stops.map((s) => s.stop));
  for (let i = 1; i <= n; i++) if (!stops.has(i)) p.push(`missing directions for stop ${i}`);
  for (const s of c.stops)
    if (!fitsEverywhere("routeStop", s.text, { stops: n })) p.push(`stop ${s.stop} text too long`);
  if (!ids.has(c.ifLost.featureId))
    p.push(`ifLost.featureId "${c.ifLost.featureId}" is not in the list`);
  if (!fitsEverywhere("ifLost", c.ifLost.text)) p.push("ifLost text too long");
  p.push(...idLeaks([...c.stops.map((s) => s.text), c.ifLost.text]));
  return p;
}

export function coverProblems(c: CoverCopy): string[] {
  const p: string[] = [];
  if (!fitsEverywhere("coverKicker", c.kicker.toUpperCase())) p.push("kicker too long");
  if (!fitsEverywhere("coverBlurb", c.blurb)) p.push("blurb too long");
  p.push(...idLeaks([c.kicker, c.blurb]));
  return p;
}
export const listenProblems = (c: ListenCopy): string[] => [
  ...(fitsEverywhere("listenIntro", c.intro) ? [] : ["intro too long"]),
  ...idLeaks([c.intro]),
];
export const backProblems = (c: BackCopy): string[] => [
  ...(fitsEverywhere("backBlurb", c.blurb) ? [] : ["blurb too long"]),
  ...idLeaks([c.blurb]),
];

/** For evals: names in copy that don't appear in the features we gave the model. */
export function suspiciousNames(text: string, ctx: WriterContext): string[] {
  const known = new Set(
    ctx.features
      .flatMap((f) => (f.name ? f.name.toLowerCase().split(/[^\p{L}\p{N}']+/u) : []))
      .filter((w) => w.length > 2),
  );
  for (const w of ctx.location.label.toLowerCase().split(/[^\p{L}\p{N}']+/u)) known.add(w);
  const out: string[] = [];
  const re =
    /\b([A-Z][\p{L}']+(?:\s+[A-Z][\p{L}']+)*)\s+(Street|St|Road|Avenue|Lane|Statue|Cafe|Café|Bakery|Church|Museum|Library|Fountain|Park|Square|Bridge)\b/gu;
  for (const m of text.matchAll(re)) {
    const words = m[1]!.toLowerCase().split(/\s+/);
    if (!words.some((w) => known.has(w))) out.push(m[0]);
  }
  return PLACE_WORDS.test(text) ? out : [];
}
