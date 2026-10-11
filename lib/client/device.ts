"use client";

export type Tier = "high" | "low" | "lite";

/**
 * How the hero fold is drawn on this device. Everyone gets the fold; only the
 * renderer changes. Cheap phones report few cores and little memory, so they
 * get the lighter WebGL scene ("low"). Data Saver and 2G connections asked for
 * less, so they get "lite": the same fold drawn with Canvas 2D, which never
 * downloads three.js. (Chrome reports a 3 GB phone as 2, so memory alone must
 * not decide more than the WebGL detail.)
 */
export function deviceTier(): Tier {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const conn = nav.connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "")) return "lite";
  if (mem <= 4 || cores <= 4) return "low";
  return "high";
}
