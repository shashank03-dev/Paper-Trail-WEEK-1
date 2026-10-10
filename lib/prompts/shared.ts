import type { Feature, WriterContext } from "@/lib/schemas";
import { compass, season } from "@/lib/geo";

export const WRITER_SYSTEM = `You are the writer of Paper Trail, a tiny printed adventure for a real walk. You only mention places from the provided list, using their ids. Never invent a shop, statue, or street that isn't in the list. Be warm, playful, and specific. Short sentences. No emoji. Safety: never send people onto private property, across major roads without crossings, or near water edges with kids; suggest daylight if it's near sunset. Reply with JSON only.`;

export function featureLine(f: Feature): string {
  const tags = Object.entries(f.tags)
    .filter(([k]) => k !== "name")
    .slice(0, 4)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return [
    f.id,
    f.kind,
    f.name ? `"${f.name}"` : "-",
    `${f.distanceM}m ${compass(f.bearingDeg)}`,
    tags || "-",
  ].join(" | ");
}

export function minutesToSunset(localTime: string, sunset: string): number | null {
  const a = localTime.match(/(\d{1,2}):(\d{2})/);
  const b = sunset.match(/(\d{1,2}):(\d{2})/);
  if (!a || !b) return null;
  return Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]));
}

export function moodNotes(ctx: WriterContext): string[] {
  const notes: string[] = [];
  const w = ctx.weather;
  const wet = ["rain", "drizzle", "storm"].includes(w.condition) || w.precipProbNext2h >= 50;
  if (wet)
    notes.push(
      `It may rain (${w.precipProbNext2h}% in the next 2h): make this a "puddle edition" — include items like "a perfect reflection in a puddle" and the vibe "rainy-day".`,
    );
  const toSunset = minutesToSunset(ctx.localTime, w.sunset);
  if (!w.isDaylight)
    notes.push(
      "It is already dark: keep the route on lit streets and suggest walking in daylight next time.",
    );
  else if (toSunset !== null && toSunset < 75)
    notes.push(
      `Sunset is in ${toSunset} min: make it "golden hour" and remind them to be home before dark.`,
    );
  if (w.condition === "snow") notes.push("It's snowy: include snowy, crunchy, frosty items.");
  if (ctx.companions === "kids")
    notes.push(
      'Walking with kids: simple words, bigger points (15-25), add one "Ask a grown-up" line, keep kids away from road and water edges.',
    );
  if (ctx.companions === "dog")
    notes.push(
      "Walking with a dog: include smell and sniff items (lamp posts, a tree a hundred dogs have visited), dog-friendly stops.",
    );
  if (ctx.companions === "friend")
    notes.push(
      "Walking with a friend: include one item to spot together and a little bet between them.",
    );
  return notes;
}

export function contextBlock(ctx: WriterContext, extra = 60): string {
  const byId = new Map(ctx.features.map((f) => [f.id, f]));
  const wpIds = new Set(ctx.route.waypoints.map((w) => w.featureId));
  const waypoints = ctx.route.waypoints.map((w, i) => {
    const f = byId.get(w.featureId);
    return `W${i + 1} = ${f ? featureLine(f) : w.featureId} | ${Math.max(1, Math.round(w.legMin))} min from ${i === 0 ? "start" : `W${i}`}`;
  });
  const others = ctx.features
    .filter((f) => !wpIds.has(f.id))
    .slice(0, extra)
    .map(featureLine);
  const s = season(ctx.date, ctx.location.lat);
  const w = ctx.weather;
  return [
    `PLACE: ${ctx.location.label}`,
    `WHEN: ${ctx.localTime}, ${s}. Weather: ${w.condition}, ${Math.round(w.tempC)}°C, wind ${Math.round(w.windKph)} km/h, sunset ${w.sunset}.`,
    `WALK: ${ctx.durationMin} min loop (${Math.round(ctx.route.totalMin)} min of walking), companions: ${ctx.companions}${ctx.walkerName ? `, walker: ${ctx.walkerName}` : ""}.`,
    "",
    "WAYPOINTS (the loop, in order; id | kind | name | distance+direction from start | tags):",
    ...waypoints,
    "",
    "OTHER NEARBY FEATURES (id | kind | name | distance | tags):",
    ...(others.length ? others : ["(none)"]),
    "",
    ...moodNotes(ctx).map((n) => `NOTE: ${n}`),
  ].join("\n");
}
