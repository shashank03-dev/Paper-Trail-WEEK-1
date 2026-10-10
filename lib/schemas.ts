import { z } from "zod";

/* ----------------------------- places & weather ----------------------------- */

export const FeatureSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string().optional(),
  tags: z.record(z.string(), z.string()),
  lat: z.number(),
  lon: z.number(),
  distanceM: z.number(),
  bearingDeg: z.number(),
});
export type Feature = z.infer<typeof FeatureSchema>;

export const WayKind = z.enum(["major", "minor", "path", "park", "water"]);
export const WaySchema = z.object({
  id: z.string(),
  kind: WayKind,
  name: z.string().optional(),
  closed: z.boolean(),
  /** [lat, lon] pairs, simplified. */
  coords: z.array(z.tuple([z.number(), z.number()])),
});
export type Way = z.infer<typeof WaySchema>;

export const PlacesSchema = z.object({
  features: z.array(FeatureSchema),
  ways: z.array(WaySchema),
});
export type Places = z.infer<typeof PlacesSchema>;

export const WeatherSchema = z.object({
  tempC: z.number(),
  condition: z.enum([
    "clear",
    "partly-cloudy",
    "cloudy",
    "fog",
    "drizzle",
    "rain",
    "snow",
    "storm",
  ]),
  precipProbNext2h: z.number(),
  windKph: z.number(),
  sunset: z.string(),
  isDaylight: z.boolean(),
});
export type Weather = z.infer<typeof WeatherSchema>;

/* ---------------------------------- route ---------------------------------- */

export const WaypointSchema = z.object({
  featureId: z.string(),
  lat: z.number(),
  lon: z.number(),
  /** Walking minutes from the previous stop (or the start). */
  legMin: z.number(),
});
export type Waypoint = z.infer<typeof WaypointSchema>;

export const RouteSchema = z.object({
  start: z.object({ lat: z.number(), lon: z.number() }),
  waypoints: z.array(WaypointSchema),
  /** Including the walk home. */
  totalMin: z.number(),
  totalM: z.number(),
});
export type Route = z.infer<typeof RouteSchema>;

export const Companions = z.enum(["solo", "kids", "dog", "friend"]);
export type Companions = z.infer<typeof Companions>;
export const Durations = [10, 20, 40] as const;
export const DurationSchema = z.union([z.literal(10), z.literal(20), z.literal(40)]);
export type Duration = z.infer<typeof DurationSchema>;
export const RADIUS_BY_DURATION: Record<Duration, number> = { 10: 350, 20: 600, 40: 900 };

export const PaperSchema = z.enum(["letter", "a4"]);
export type Paper = z.infer<typeof PaperSchema>;

/* ------------------------------ writer: plan ------------------------------- */

export const Points = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
  z.literal(20),
  z.literal(25),
]);

export const LIMITS = {
  title: 48,
  subtitle: 70,
  ispyLabel: 34,
  ispyHint: 48,
  riddleText: 230,
  riddleAnswer: 40,
  sketchPrompt: 90,
  coverKicker: 44,
  coverBlurb: 120,
  routeStop: 104,
  ifLost: 70,
  listenIntro: 150,
  backBlurb: 120,
} as const;

export const IspyItemSchema = z.object({
  featureId: z.string().nullable(),
  label: z.string().min(2).max(LIMITS.ispyLabel),
  hint: z.string().max(LIMITS.ispyHint),
  points: Points,
});
export type IspyItem = z.infer<typeof IspyItemSchema>;

export const RiddleSchema = z.object({
  targetFeatureId: z.string(),
  text: z.string().min(10).max(LIMITS.riddleText),
  answer: z.string().min(1).max(LIMITS.riddleAnswer),
  acceptable: z.array(z.string().max(LIMITS.riddleAnswer)).max(8),
});
export type Riddle = z.infer<typeof RiddleSchema>;

export const Vibe = z.enum(["cozy", "curious", "spooky", "sunny", "rainy-day", "golden-hour"]);

export const TrailPlanSchema = z.object({
  title: z.string().min(3).max(LIMITS.title),
  subtitle: z.string().max(LIMITS.subtitle),
  vibe: Vibe,
  ispy: z.array(IspyItemSchema).min(8).max(10),
  riddle: RiddleSchema,
  sketchPrompt: z.string().min(5).max(LIMITS.sketchPrompt),
  listenStop: z.number().int().min(1).max(6),
});
export type TrailPlan = z.infer<typeof TrailPlanSchema>;

/* ------------------------------ writer: panels ----------------------------- */

export const CoverCopySchema = z.object({
  kicker: z.string().max(LIMITS.coverKicker),
  blurb: z.string().max(LIMITS.coverBlurb),
});
export const RouteCopySchema = z.object({
  stops: z
    .array(
      z.object({ stop: z.number().int().min(1).max(6), text: z.string().max(LIMITS.routeStop) }),
    )
    .min(1)
    .max(6),
  ifLost: z.object({ featureId: z.string(), text: z.string().max(LIMITS.ifLost) }),
});
export const ListenCopySchema = z.object({ intro: z.string().max(LIMITS.listenIntro) });
export const BackCopySchema = z.object({ blurb: z.string().max(LIMITS.backBlurb) });

export type CoverCopy = z.infer<typeof CoverCopySchema>;
export type RouteCopy = z.infer<typeof RouteCopySchema>;
export type ListenCopy = z.infer<typeof ListenCopySchema>;
export type BackCopy = z.infer<typeof BackCopySchema>;

export const PanelsSchema = z.object({
  cover: CoverCopySchema.optional(),
  route: RouteCopySchema.optional(),
  listen: ListenCopySchema.optional(),
  back: BackCopySchema.optional(),
});
export type Panels = z.infer<typeof PanelsSchema>;

export const CopyPanel = z.enum(["cover", "route", "listen", "back"]);
export type CopyPanel = z.infer<typeof CopyPanel>;
/** Plan parts that can be re-rolled on their own. */
export const PlanPanel = z.enum(["ispy", "riddle", "sketch"]);
export type PlanPanel = z.infer<typeof PlanPanel>;
export const RegenPanel = z.union([CopyPanel, PlanPanel]);
export type RegenPanel = z.infer<typeof RegenPanel>;

export const GenPath = z.enum(["llm", "llm-retry", "replay", "fallback"]);
export type GenPath = z.infer<typeof GenPath>;

/* ------------------------------ writer context ----------------------------- */

export const WriterContextSchema = z.object({
  presetId: z.string().optional(),
  location: z.object({ lat: z.number(), lon: z.number(), label: z.string().max(120) }),
  route: RouteSchema,
  features: z.array(FeatureSchema).max(140),
  weather: WeatherSchema,
  localTime: z.string().max(40),
  /** ISO date of the walk, used for season. */
  date: z.string().max(40),
  durationMin: DurationSchema,
  companions: Companions,
  walkerName: z.string().max(40).optional(),
  edition: z.number().int().min(1).max(9999),
});
export type WriterContext = z.infer<typeof WriterContextSchema>;

/* --------------------------------- reader ---------------------------------- */

export const Verdict = z.enum(["correct", "close", "incorrect", "blank"]);

export const FieldReportSchema = z.object({
  ispy: z.array(
    z.object({
      index: z.number().int(),
      spotted: z.boolean(),
      confidence: z.number().min(0).max(1),
      source: z.enum(["gemma", "omr", "both", "user"]),
      unsure: z.boolean().optional(),
      gemma: z.boolean().nullable().optional(),
      omrInk: z.number().optional(),
    }),
  ),
  listen: z.object({
    loudest: z.string().nullable(),
    quietest: z.string().nullable(),
    newSound: z.string().nullable(),
  }),
  riddle: z.object({ written: z.string().nullable(), verdict: Verdict, note: z.string() }),
  sketch: z.object({ description: z.string(), isBlank: z.boolean() }),
  letter: z.string(),
});
export type FieldReport = z.infer<typeof FieldReportSchema>;

/** What the reader expects to find on the sheet. */
export const ExpectedSchema = z.object({
  ispy: z.array(z.object({ label: z.string(), points: z.number() })).max(10),
  riddle: z.object({ text: z.string(), answer: z.string(), acceptable: z.array(z.string()) }),
  sketchPrompt: z.string(),
  listenStop: z.number(),
  walkerName: z.string().optional(),
  title: z.string().optional(),
});
export type Expected = z.infer<typeof ExpectedSchema>;
