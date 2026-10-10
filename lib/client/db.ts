"use client";
import Dexie, { type Table } from "dexie";
import type {
  Companions,
  Duration,
  Feature,
  FieldReport,
  GenPath,
  Panels,
  Paper,
  Route,
  TrailPlan,
  Way,
  Weather,
} from "@/lib/schemas";
import type { ScoreBreakdown } from "@/lib/reader/score";

export interface TrailRecord {
  id: string;
  createdAt: number;
  printedAt?: number;
  returnedAt?: number;
  location: { lat: number; lon: number; label: string };
  presetId?: string;
  durationMin: Duration;
  companions: Companions;
  walkerName?: string;
  edition: number;
  paper: Paper;
  color: boolean;
  plan?: TrailPlan;
  panels: Panels;
  route: Route;
  features: Feature[];
  ways: Way[];
  weather: Weather;
  localTime: string;
  model: string;
  /** Provider label when the trail was written by a hosted API. */
  hostedOn?: string;
  genPaths: Record<string, GenPath>;
  outsideMs?: number;
  report?: FieldReport;
  labels?: string[];
  score?: ScoreBreakdown;
  stamp?: { text: string; date: number; points: number };
  sketchThumb?: string;
  inBook?: boolean;
}

export interface SessionRecord {
  id?: number;
  trailId: string;
  phase: "setup" | "preview" | "return";
  startedAt: number;
  ms: number;
}

class PaperTrailDB extends Dexie {
  trails!: Table<TrailRecord, string>;
  sessions!: Table<SessionRecord, number>;
  constructor() {
    super("papertrail");
    this.version(1).stores({ trails: "id, createdAt, inBook", sessions: "++id, trailId" });
  }
}

let _db: PaperTrailDB | null = null;
export function db(): PaperTrailDB {
  if (!_db) _db = new PaperTrailDB();
  return _db;
}

export async function screenMs(trailId: string): Promise<number> {
  const rows = await db().sessions.where("trailId").equals(trailId).toArray();
  return rows.reduce((s, r) => s + r.ms, 0);
}

export async function nextEdition(): Promise<number> {
  return (await db().trails.count()) + 1;
}

/** Setup happens before a trail id exists; its time is parked here and moved over on create. */
export const PENDING = "__pending__";
export async function adoptPendingSessions(trailId: string) {
  await db().sessions.where("trailId").equals(PENDING).modify({ trailId });
}
