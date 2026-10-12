import { logLine } from "@/lib/server/observe";

/**
 * Render's free web services spin down after 15 minutes without inbound
 * traffic, and the next visitor waits about a minute for a cold start. So the
 * server asks for its own public URL every few minutes: the request leaves the
 * instance and comes back through Render's edge, which counts as traffic.
 * /api/config reads env only and never calls the model, so pings cost no quota.
 *
 * On by default only on Render (which sets RENDER_EXTERNAL_URL); KEEP_AWAKE_URL
 * points it anywhere else, KEEP_AWAKE=off turns it off.
 */
export interface KeepAwake {
  url: string;
  intervalMs: number;
}

export function keepAwakeConfig(env: Record<string, string | undefined>): KeepAwake | null {
  if (env.KEEP_AWAKE === "off") return null;
  const base = env.KEEP_AWAKE_URL?.trim() || env.RENDER_EXTERNAL_URL?.trim();
  if (!base) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // A bare origin means "ping the cheap endpoint"; a full URL is used as given.
  if (url.pathname === "/" && !url.search) url.pathname = "/api/config";
  const minutes = Number(env.KEEP_AWAKE_INTERVAL_MIN);
  // Under 15 minutes or it's pointless; at least 1 so it can't hammer itself.
  const clamped = Number.isFinite(minutes) && minutes > 0 ? Math.min(Math.max(minutes, 1), 14) : 10;
  return { url: url.toString(), intervalMs: clamped * 60_000 };
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startKeepAwake(env: Record<string, string | undefined> = process.env): void {
  const cfg = keepAwakeConfig(env);
  if (!cfg || timer) return;
  const ping = async () => {
    try {
      const res = await fetch(cfg.url, {
        headers: { "user-agent": "paper-trail-keep-awake" },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) logLine({ route: "keep-awake", status: res.status });
    } catch (e) {
      logLine({ route: "keep-awake", error: (e as Error)?.name ?? "error" });
    }
  };
  timer = setInterval(ping, cfg.intervalMs);
  // Never hold the process open just to ping.
  timer.unref?.();
  logLine({ route: "keep-awake", intervalMin: cfg.intervalMs / 60_000 });
}
