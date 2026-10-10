import places from "@/fixtures/places/dolores-park.json";
import weather from "@/fixtures/weather/dolores-park.json";
import type { Places, Weather } from "@/lib/schemas";
import type { ZineData } from "@/lib/zine/primitives";
import { buildContext } from "@/lib/writer/context";
import { fallbackPlan, fallbackRoute } from "@/lib/writer/fallback";
import { PRESETS } from "@/lib/presets";

/** A finished example trail (Dolores Park) for the landing page: real features, hand-picked copy. */
export function demoZine(): ZineData {
  const p = PRESETS.find((x) => x.id === "dolores-park")!;
  const ctx = buildContext({
    places: places as unknown as Places,
    weather: weather as Weather,
    location: { lat: p.lat, lon: p.lon, label: "Dolores Park, San Francisco" },
    durationMin: 20,
    companions: "solo",
    walkerName: "Sam",
    edition: 7,
    presetId: p.id,
    now: new Date("2026-10-11T09:30:00Z"),
  });
  const base = fallbackPlan(ctx);
  const plan = {
    ...base,
    title: "The Golden Hydrant Loop",
    subtitle: "Six stops around Dolores Park and one pencil",
    sketchPrompt: "Draw the palm tree that looks most like it's waving at you.",
  };
  return {
    id: "demo-dolores",
    paper: "letter",
    color: true,
    plan,
    panels: {
      cover: {
        kicker: "A field guide for Sam",
        blurb:
          "19°C and clear. Leave the phone on the table. Everything on this sheet is really out there.",
      },
      route: fallbackRoute(ctx),
      listen: {
        intro: `Stand still at stop ${plan.listenStop}. Close your eyes for 60 seconds. Listen for wheels, wings and someone laughing.`,
      },
      back: { blurb: "Come back with a crumpled, scribbled sheet. That's how we know it worked." },
    },
    route: ctx.route,
    features: ctx.features,
    ways: (places as unknown as Places).ways,
    weather: weather as Weather,
    date: ctx.date,
    walkerName: "Sam",
    edition: 7,
    model: "gemma4:e4b",
    deviceLabel: "a laptop",
    returnUrl: "https://paper-trail.example/return/demo",
    repoUrl: "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
    locationLabel: "Dolores Park, San Francisco",
    durationMin: 20,
  };
}
