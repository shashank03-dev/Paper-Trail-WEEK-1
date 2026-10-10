/**
 * Deterministic templates that still use the real features, so the app never
 * dead-ends when the model is down or keeps failing validation.
 */
import type {
  BackCopy,
  CoverCopy,
  Feature,
  IspyItem,
  ListenCopy,
  Riddle,
  RouteCopy,
  TrailPlan,
  WriterContext,
} from "@/lib/schemas";
import { LIMITS } from "@/lib/schemas";
import { bearingDeg, compass, season } from "@/lib/geo";
import { interest } from "@/lib/route";
import { minutesToSunset } from "@/lib/prompts/shared";
import { featureLabel } from "@/lib/zine/primitives";

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

const ISPY_TEMPLATES: Record<string, [string, string]> = {
  bench: ["A bench with a view", "sit for three seconds, then tick"],
  drinking_water: ["A drinking fountain", "does it still work?"],
  post_box: ["A post box", "what time is the last collection?"],
  fountain: ["A fountain", "count the jets"],
  library: ["The library", "spot a book through the window"],
  cafe: ["A café smell", "coffee, toast or cake?"],
  bicycle_parking: ["A bike rack", "find the oldest bike"],
  clock: ["A public clock", "is it right?"],
  waste_basket: ["A bin with a sticker", "read the sticker"],
  park: ["The park gate", "who's going in?"],
  playground: ["The playground", "the tallest slide wins"],
  garden: ["A garden in bloom", "name one colour"],
  tree: ["A big old tree", "hug it if nobody's looking"],
  water: ["The water", "spot a bird on it"],
  wood: ["The little wood", "listen for a crunch"],
  artwork: ["An artwork", "what would you call it?"],
  mural: ["A mural", "find a face in it"],
  statue: ["A statue", "who is it looking at?"],
  memorial: ["A memorial", "read one word on it"],
  viewpoint: ["The view", "find the farthest thing"],
  historic: ["Something old", "find a date on it"],
  bus_stop: ["The bus stop", "where does it go?"],
  street_lamp: ["An old street lamp", "is it on?"],
  man_made: ["A curious structure", "what is it for?"],
  bakery: ["The bakery window", "pick your favourite"],
  florist: ["The florist's buckets", "count the colours"],
};

function ambientItems(ctx: WriterContext): IspyItem[] {
  const s = season(ctx.date, ctx.location.lat);
  const wet =
    ["rain", "drizzle", "storm"].includes(ctx.weather.condition) ||
    ctx.weather.precipProbNext2h >= 50;
  const out: IspyItem[] = [];
  if (wet)
    out.push({
      featureId: null,
      label: "A perfect puddle reflection",
      hint: "find the sky on the ground",
      points: 15,
    });
  out.push(
    s === "autumn"
      ? {
          featureId: null,
          label: "A leaf that's two colours",
          hint: "half green, half something else",
          points: 10,
        }
      : s === "spring"
        ? {
            featureId: null,
            label: "A brand-new bud",
            hint: "smaller than your fingernail",
            points: 10,
          }
        : s === "winter"
          ? {
              featureId: null,
              label: "Your breath in the air",
              hint: "or someone's steamy window",
              points: 10,
            }
          : {
              featureId: null,
              label: "A patch of perfect shade",
              hint: "stand in it for a moment",
              points: 10,
            },
  );
  out.push({
    featureId: null,
    label: "A cloud shaped like an animal",
    hint: "which animal?",
    points: 15,
  });
  if (ctx.companions === "dog")
    out.push({
      featureId: null,
      label: "The most-sniffed lamp post",
      hint: "your dog will know",
      points: 20,
    });
  else if (ctx.companions === "kids")
    out.push({
      featureId: null,
      label: "Something smaller than an ant",
      hint: "ask a grown-up to look too",
      points: 25,
    });
  else
    out.push({
      featureId: null,
      label: "Someone else not on a phone",
      hint: "give them a nod",
      points: 20,
    });
  return out;
}

function points(f: Feature, ctx: WriterContext): 5 | 10 | 15 | 20 | 25 {
  const count = ctx.features.filter((g) => g.kind === f.kind).length;
  const base = count <= 1 ? 20 : count <= 3 ? 15 : count <= 8 ? 10 : 5;
  const bump = ctx.companions === "kids" ? 5 : 0;
  return Math.min(25, base + bump) as 5 | 10 | 15 | 20 | 25;
}

export function fallbackIspy(ctx: WriterContext): IspyItem[] {
  const wpIds = ctx.route.waypoints.map((w) => w.featureId);
  const byId = new Map(ctx.features.map((f) => [f.id, f]));
  const pool = [
    ...wpIds.map((id) => byId.get(id)).filter((f): f is Feature => !!f),
    ...[...ctx.features]
      .filter((f) => !wpIds.includes(f.id))
      .sort((a, b) => interest(b) - interest(a)),
  ];
  const items: IspyItem[] = [];
  const seenLabels = new Set<string>();
  for (const f of pool) {
    if (items.length >= 7) break;
    const [tl, th] = ISPY_TEMPLATES[f.kind] ?? ["Something curious", "what is it?"];
    const label = clip(f.name ?? tl, LIMITS.ispyLabel);
    if (seenLabels.has(label.toLowerCase())) continue;
    seenLabels.add(label.toLowerCase());
    items.push({
      featureId: f.id,
      label,
      hint: clip(f.name ? th : `${f.distanceM} m ${compass(f.bearingDeg)}, ${th}`, LIMITS.ispyHint),
      points: points(f, ctx),
    });
  }
  for (const a of ambientItems(ctx)) if (items.length < 10) items.push(a);
  while (items.length < 8)
    items.push({
      featureId: null,
      label: `Something ${["round", "red", "tiny", "noisy"][items.length % 4]}`,
      hint: "you decide what counts",
      points: 5,
    });
  return items;
}

const RIDDLES: Record<string, (name: string) => [string, string, string[]]> = {
  fountain: () => [
    "I sing all day but have no song,\nI'm full of sky and never long.\nThrow me a wish, I'll keep it wet.\nWhat am I? Don't forget.",
    "fountain",
    ["water fountain", "a fountain"],
  ],
  drinking_water: () => [
    "I'm always full, I'm never sad,\nI give you something good, not bad.\nPress my button, bend your head.\nWhat am I? Enough said.",
    "drinking fountain",
    ["water fountain", "fountain", "tap"],
  ],
  bench: () => [
    "I have four legs but never run,\nI wait all day in rain and sun.\nYou sit on me to rest your feet.\nWhat am I, along the street?",
    "bench",
    ["a bench", "seat"],
  ],
  tree: () => [
    "I wear green clothes in summer heat,\nI drop them all around your feet.\nI'm older than your oldest friend.\nWhat am I, around the bend?",
    "tree",
    ["a tree", "big tree"],
  ],
  post_box: () => [
    "I eat your words but never read,\nI'm hungry for the notes you need.\nMy mouth is thin, my coat is bright.\nWhat am I, from morning to night?",
    "post box",
    ["postbox", "mailbox", "letter box"],
  ],
  library: () => [
    "I hold a thousand voices tight,\nI never speak, but I am right.\nCome in and borrow, bring me back.\nWhat am I, with shelf and stack?",
    "library",
    ["the library"],
  ],
  playground: () => [
    "I'm full of shouts but have no voice,\nI've slides and swings to make your choice.\nThe grown-ups sit, the small ones fly.\nWhat am I, beneath the sky?",
    "playground",
    ["park", "swings"],
  ],
};

export function fallbackRiddle(ctx: WriterContext): Riddle {
  const byId = new Map(ctx.features.map((f) => [f.id, f]));
  const wps = ctx.route.waypoints
    .map((w) => byId.get(w.featureId))
    .filter((f): f is Feature => !!f);
  const target =
    wps.find((f) => RIDDLES[f.kind]) ?? wps.sort((a, b) => interest(b) - interest(a))[0]!;
  const tpl = RIDDLES[target.kind];
  if (tpl) {
    const [text, answer, acceptable] = tpl(target.name ?? "");
    return {
      targetFeatureId: target.id,
      text,
      answer,
      acceptable: target.name ? [...acceptable, target.name] : acceptable,
    };
  }
  const name = featureLabel(target).replace(/^(a|an|the) /i, "");
  return {
    targetFeatureId: target.id,
    text: `I'm on your loop, I'm on your map,\nI never move, I never nap.\nI'm stop number ${ctx.route.waypoints.findIndex((w) => w.featureId === target.id) + 1}, now look and see.\nWhat am I? Write me.`,
    answer: clip(name, LIMITS.riddleAnswer),
    acceptable: [target.kind.replace(/_/g, " ")],
  };
}

export function fallbackSketch(ctx: WriterContext): string {
  if (ctx.companions === "dog") return "Draw your dog's favourite smell on this walk (somehow).";
  if (ctx.companions === "kids")
    return "Draw the silliest-looking tree you passed, and give it a name.";
  if (ctx.companions === "friend") return "Draw your friend as the statue this street is missing.";
  return "Draw the strangest tree on your route.";
}

export function fallbackPlan(ctx: WriterContext): TrailPlan {
  const byId = new Map(ctx.features.map((f) => [f.id, f]));
  const wps = ctx.route.waypoints
    .map((w) => byId.get(w.featureId))
    .filter((f): f is Feature => !!f);
  const star = [...wps].sort((a, b) => interest(b) - interest(a))[0];
  const place = star?.name ?? ctx.location.label.split(",")[0] ?? "Your Street";
  const title = clip(`The Secret Life of ${place}`, LIMITS.title);
  const wet =
    ["rain", "drizzle", "storm"].includes(ctx.weather.condition) ||
    ctx.weather.precipProbNext2h >= 50;
  const toSunset = minutesToSunset(ctx.localTime, ctx.weather.sunset);
  const vibe: TrailPlan["vibe"] = wet
    ? "rainy-day"
    : toSunset !== null && toSunset < 75
      ? "golden-hour"
      : ctx.weather.condition === "clear"
        ? "sunny"
        : "curious";
  const calmKinds = ["park", "garden", "tree", "bench", "water", "wood", "viewpoint"];
  const calm = ctx.route.waypoints.findIndex((w) =>
    calmKinds.includes(byId.get(w.featureId)?.kind ?? ""),
  );
  return {
    title,
    subtitle: clip(
      `${ctx.route.waypoints.length} stops, ${ctx.durationMin} minutes, one pencil${wet ? ", puddles welcome" : ""}`,
      LIMITS.subtitle,
    ),
    vibe,
    ispy: fallbackIspy(ctx),
    riddle: fallbackRiddle(ctx),
    sketchPrompt: fallbackSketch(ctx),
    listenStop: calm >= 0 ? calm + 1 : Math.max(1, Math.ceil(ctx.route.waypoints.length / 2)),
  };
}

export function fallbackCover(ctx: WriterContext): CoverCopy {
  const w = ctx.weather;
  return {
    kicker: clip(
      ctx.walkerName ? `A field guide for ${ctx.walkerName}` : "A field guide for one short walk",
      LIMITS.coverKicker,
    ),
    blurb: clip(
      `${Math.round(w.tempC)}°C and ${w.condition.replace("-", " ")}. Leave the phone. Take a pencil. Everything on this sheet is really out there.`,
      LIMITS.coverBlurb,
    ),
  };
}

export function fallbackRoute(ctx: WriterContext): RouteCopy {
  const byId = new Map(ctx.features.map((f) => [f.id, f]));
  const n = ctx.route.waypoints.length;
  const stops = ctx.route.waypoints.map((w, i) => {
    const f = byId.get(w.featureId);
    const prev = i === 0 ? ctx.route.start : ctx.route.waypoints[i - 1]!;
    const dir = compass(bearingDeg(prev.lat, prev.lon, w.lat, w.lon));
    const tail = i === n - 1 ? " Then wander back to the start." : "";
    return {
      stop: i + 1,
      text: clip(
        `Head ${dir} to ${featureLabel(f)}, about ${Math.max(1, Math.round(w.legMin))} min.${tail}`,
        LIMITS.routeStop,
      ),
    };
  });
  const anchor =
    [...ctx.features].filter((f) => f.name).sort((a, b) => a.distanceM - b.distanceM)[0] ??
    byId.get(ctx.route.waypoints[0]!.featureId)!;
  return {
    stops,
    ifLost: {
      featureId: anchor.id,
      text: clip(
        `If you get lost: head toward ${featureLabel(anchor)} and you're home.`,
        LIMITS.ifLost,
      ),
    },
  };
}

export function fallbackListen(_ctx: WriterContext, plan: TrailPlan): ListenCopy {
  return {
    intro: clip(
      `Stand still at stop ${plan.listenStop}. Close your eyes for 60 seconds. Count the sounds on your fingers, then write three of them down.`,
      LIMITS.listenIntro,
    ),
  };
}

export function fallbackBack(): BackCopy {
  return {
    blurb:
      "Your phone waited at home the whole time. Bring this sheet back crumpled and scribbled; that's how we know it worked.",
  };
}
