"use client";
import { useEffect } from "react";
import { db, type SessionRecord } from "./db";

/**
 * Counts active (visible) time on Paper Trail pages for a trail, using the
 * Page Visibility API. The screen half of "Screen vs Outside".
 */
export function useScreenTime(trailId: string | null, phase: SessionRecord["phase"]) {
  useEffect(() => {
    if (!trailId) return;
    let rowId: number | undefined;
    let since = document.visibilityState === "visible" ? performance.now() : null;
    let acc = 0;
    let stopped = false;
    const started = Date.now();
    const flush = async () => {
      if (since !== null) {
        acc += performance.now() - since;
        since = document.visibilityState === "visible" && !stopped ? performance.now() : null;
      }
      const ms = Math.round(acc);
      try {
        if (rowId === undefined)
          rowId = await db().sessions.add({ trailId, phase, startedAt: started, ms });
        else await db().sessions.update(rowId, { ms });
      } catch {
        /* storage unavailable: the counter just stays at zero */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") since = performance.now();
      else void flush();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(() => void flush(), 4000);
    void flush();
    return () => {
      stopped = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      void flush();
    };
  }, [trailId, phase]);
}
