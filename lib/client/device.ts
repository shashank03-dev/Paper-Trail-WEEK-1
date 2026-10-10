"use client";

export type Tier = "high" | "low" | "still";

/**
 * How much 3D this device should get. Cheap phones report few cores and little
 * memory; Data Saver users asked for less. "still" skips WebGL entirely and
 * shows the printed sheet as an image.
 */
export function deviceTier(): Tier {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const conn = nav.connection;
  if (conn?.saveData || mem <= 2 || /(^|-)2g$/.test(conn?.effectiveType ?? "")) return "still";
  if (mem <= 4 || cores <= 4) return "low";
  return "high";
}
