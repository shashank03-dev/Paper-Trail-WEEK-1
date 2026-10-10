import type { Feature, Places, Weather, WriterContext, Companions, Duration } from "@/lib/schemas";
import { selectRoute } from "@/lib/route";

/** Build the writer context the client sends to the server (route is computed client-side, deterministically). */
export function buildContext(args: {
  places: Places;
  weather: Weather;
  location: { lat: number; lon: number; label: string };
  durationMin: Duration;
  companions: Companions;
  walkerName?: string;
  edition: number;
  presetId?: string;
  now?: Date;
}): WriterContext {
  const now = args.now ?? new Date();
  const route = selectRoute(args.places.features, args.location, args.durationMin);
  const wp = new Set(route.waypoints.map((w) => w.featureId));
  // Waypoints first, then the rest by distance, capped for the prompt.
  const features: Feature[] = [
    ...args.places.features.filter((f) => wp.has(f.id)),
    ...args.places.features.filter((f) => !wp.has(f.id)),
  ].slice(0, 120);
  return {
    ...(args.presetId ? { presetId: args.presetId } : {}),
    location: args.location,
    route,
    features,
    weather: args.weather,
    localTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    date: now.toISOString(),
    durationMin: args.durationMin,
    companions: args.companions,
    ...(args.walkerName ? { walkerName: args.walkerName.slice(0, 40) } : {}),
    edition: args.edition,
  };
}
