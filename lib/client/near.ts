"use client";
import { db } from "./db";

/** Where search suggestions should look first. `precise` = a real spot, not a region. */
export interface Near {
  lat: number;
  lon: number;
  precise: boolean;
}

/** ~1 km: enough to rank nearby places first, never an exact address. */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * A hint of where the walker is, without ever prompting: their last trail's
 * start (kept in this browser), else their position if location access was
 * already granted, else the region of their device's time zone.
 */
export async function nearHint(): Promise<Near | null> {
  try {
    const last = await db().trails.orderBy("createdAt").last();
    if (last?.location)
      return { lat: round(last.location.lat), lon: round(last.location.lon), precise: true };
  } catch {
    /* no history store (private mode): carry on */
  }
  try {
    const perm = await navigator.permissions?.query({ name: "geolocation" });
    if (perm?.state === "granted") {
      const p = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: false,
          maximumAge: 15 * 60 * 1000,
          timeout: 4000,
        }),
      );
      return { lat: round(p.coords.latitude), lon: round(p.coords.longitude), precise: true };
    }
  } catch {
    /* not granted, or no fix in time */
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { TZ_CENTRES } = await import("@/lib/tzCentres");
    const c = TZ_CENTRES[tz];
    if (c) return { lat: c[0], lon: c[1], precise: false };
  } catch {
    /* unknown zone */
  }
  return null;
}

export const roundNear = (n: Near): Near => ({ ...n, lat: round(n.lat), lon: round(n.lon) });
