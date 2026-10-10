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
  if (!fitsEverywhere("riddleText", r.text))
    p.push("riddle text is too long for its panel; make it shorter");
  return p;
}

export function planProblems(plan: TrailPlan, ctx: WriterContext): string[] {
  const p = [...ispyProblems(plan.ispy, ctx), ...riddleProblems(plan.riddle, ctx)];
  if (plan.listenStop > ctx.route.waypoints.length)
    p.push(`listenStop must be 1..${ctx.route.waypoints.length}`);
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
  return p;
}

export function coverProblems(c: CoverCopy): string[] {
  const p: string[] = [];
  if (!fitsEverywhere("coverKicker", c.kicker.toUpperCase())) p.push("kicker too long");
  if (!fitsEverywhere("coverBlurb", c.blurb)) p.push("blurb too long");
  return p;
}
export const listenProblems = (c: ListenCopy): string[] =>
  fitsEverywhere("listenIntro", c.intro) ? [] : ["intro too long"];
export const backProblems = (c: BackCopy): string[] =>
  fitsEverywhere("backBlurb", c.blurb) ? [] : ["blurb too long"];

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
