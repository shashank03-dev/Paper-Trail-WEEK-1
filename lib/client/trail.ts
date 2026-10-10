"use client";
import { customAlphabet } from "nanoid";
import type { WriterContext } from "@/lib/schemas";
import type { ZineData } from "@/lib/zine/primitives";
import type { TrailRecord } from "./db";
import type { PublicConfig } from "./api";

export const newTrailId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

export function contextFromTrail(t: TrailRecord): WriterContext {
  return {
    ...(t.presetId ? { presetId: t.presetId } : {}),
    location: t.location,
    route: t.route,
    features: t.features,
    weather: t.weather,
    localTime: t.localTime,
    date: new Date(t.createdAt).toISOString(),
    durationMin: t.durationMin,
    companions: t.companions,
    ...(t.walkerName ? { walkerName: t.walkerName } : {}),
    edition: t.edition,
  };
}

export function returnUrl(id: string, cfg?: PublicConfig | null): string {
  const base =
    cfg?.publicUrl ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/return/${id}`;
}

export function zineData(
  t: TrailRecord,
  cfg: PublicConfig | null,
  over: Partial<ZineData> = {},
): ZineData {
  return {
    id: t.id,
    paper: t.paper,
    color: t.color,
    plan: t.plan,
    panels: t.panels,
    route: t.route,
    features: t.features,
    ways: t.ways,
    weather: t.weather,
    date: new Date(t.createdAt).toISOString(),
    walkerName: t.walkerName,
    edition: t.edition,
    model: t.model,
    deviceLabel: cfg?.deviceLabel ?? "my laptop",
    returnUrl: returnUrl(t.id, cfg),
    repoUrl: cfg?.repoUrl ?? "https://github.com/shashank03-dev/Paper-Trail-WEEK-1",
    locationLabel: t.location.label,
    durationMin: t.durationMin,
    ...(t.hostedOn ? { hostedOn: t.hostedOn } : {}),
    ...over,
  };
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}
