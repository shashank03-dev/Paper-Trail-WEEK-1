import dolores from "@/fixtures/places/dolores-park.json";
import doloresWeather from "@/fixtures/weather/dolores-park.json";
import cubbon from "@/fixtures/places/cubbon-park.json";
import cubbonWeather from "@/fixtures/weather/cubbon-park.json";
import vondel from "@/fixtures/places/vondelpark.json";
import vondelWeather from "@/fixtures/weather/vondelpark.json";
import type { Places, Weather } from "@/lib/schemas";
import type { ZineData } from "@/lib/zine/primitives";
import { buildContext } from "@/lib/writer/context";
import { fallbackPlan, fallbackRoute } from "@/lib/writer/fallback";
import { PRESETS } from "@/lib/presets";

interface Demo {
  presetId: string;
  places: unknown;
  weather: unknown;
  label: string;
  walker: string;
  edition: number;
  title: string;
  subtitle: string;
  sketchPrompt: string;
  kicker: string;
  blurb: string;
  listen: string;
  back: string;
}

/** Hand-picked copy over real OpenStreetMap features, one finished trail per demo place. */
const DEMOS: Demo[] = [
  {
    presetId: "dolores-park",
    places: dolores,
    weather: doloresWeather,
    label: "Dolores Park, San Francisco",
    walker: "Sam",
    edition: 7,
    title: "The Golden Hydrant Loop",
    subtitle: "Six stops around Dolores Park and one pencil",
    sketchPrompt: "Draw the palm tree that looks most like it's waving at you.",
    kicker: "A field guide for Sam",
    blurb:
      "19°C and clear. Leave the phone on the table. Everything on this sheet is really out there.",
    listen: "Close your eyes for 60 seconds. Listen for wheels, wings and someone laughing.",
    back: "Come back with a crumpled, scribbled sheet. That's how we know it worked.",
  },
  {
    presetId: "cubbon-park",
    places: cubbon,
    weather: cubbonWeather,
    label: "Cubbon Park, Bengaluru",
    walker: "Asha",
    edition: 12,
    title: "Under the Rain Trees",
    subtitle: "A red library, a bandstand and a lot of shade",
    sketchPrompt: "Draw the widest tree you pass. Make it wider than the page.",
    kicker: "A field guide for Asha",
    blurb: "Warm and still. The trees are older than the roads. Look up at least twice.",
    listen: "Count three different birds before you count to sixty.",
    back: "Bring back the sheet, the pencil and one leaf if it fell on its own.",
  },
  {
    presetId: "vondelpark",
    places: vondel,
    weather: vondelWeather,
    label: "Vondelpark, Amsterdam",
    walker: "Joris",
    edition: 3,
    title: "Bicycles, Roses and a Picasso",
    subtitle: "A loop past the ponds and the rose garden",
    sketchPrompt: "Draw the Picasso from memory, ten steps after you've passed it.",
    kicker: "A field guide for Joris",
    blurb:
      "Cool, a little wind. Bring a layer. The herons don't mind the bikes, and neither should you.",
    listen: "Stand by the water. Which is louder, the bells or the ducks?",
    back: "Fold it back up, bring it home, take one photo. The Trail Office will write back.",
  },
];

function build(d: Demo): ZineData {
  const p = PRESETS.find((x) => x.id === d.presetId)!;
  const places = d.places as Places;
  const weather = d.weather as Weather;
  const ctx = buildContext({
    places,
    weather,
    location: { lat: p.lat, lon: p.lon, label: d.label },
    durationMin: 20,
    companions: "solo",
    walkerName: d.walker,
    edition: d.edition,
    presetId: p.id,
    now: new Date("2026-10-11T09:30:00Z"),
  });
  const plan = {
    ...fallbackPlan(ctx),
    title: d.title,
    subtitle: d.subtitle,
    sketchPrompt: d.sketchPrompt,
  };
  return {
    id: `demo-${d.presetId}`,
    paper: "letter",
    color: true,
    plan,
    panels: {
      cover: { kicker: d.kicker, blurb: d.blurb },
      route: fallbackRoute(ctx),
      listen: { intro: `Stand still at stop ${plan.listenStop}. ${d.listen}` },
      back: { blurb: d.back },
    },
    route: ctx.route,
    features: ctx.features,
    ways: places.ways,
    weather,
    date: ctx.date,
    walkerName: d.walker,
    edition: d.edition,
    model: "gemma4:e4b",
    deviceLabel: "a laptop",
    returnUrl: "https://paper-trail.example/return/demo",
    repoUrl: "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
    locationLabel: d.label,
    durationMin: 20,
  };
}

/** A finished example trail (Dolores Park) for the landing page: real features, hand-picked copy. */
export function demoZine(): ZineData {
  return build(DEMOS[0]!);
}

/** All three demo trails, for the shelf on the landing page. */
export function demoZines(): ZineData[] {
  return DEMOS.map(build);
}
