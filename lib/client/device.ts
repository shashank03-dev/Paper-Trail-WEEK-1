"use client";

export type Tier = "high" | "low" | "still";

/**
 * How much 3D this device should get. Cheap phones report few cores and little
 * memory, so they get the lighter scene ("low"): it still folds. Only Data
 * Saver and 2G connections, who asked for less, get "still", which skips WebGL
 * and shows the printed sheet as an image. (Chrome reports a 3 GB phone as 2,
 * so memory alone must not turn the fold off.)
 */
export function deviceTier(): Tier {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const mem = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const conn = nav.connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? "")) return "still";
  if (mem <= 4 || cores <= 4) return "low";
  return "high";
}
