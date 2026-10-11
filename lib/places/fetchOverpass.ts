import type { OverpassResponse } from "./overpass";

/**
 * Public Overpass instances, tried in order. A single instance can be down,
 * rate-limiting, or simply unreachable from a given host (the main one
 * refused connections from the deployed server), so one failure must not
 * end the walk. All serve the same worldwide OpenStreetMap data.
 */
export const DEFAULT_OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface Attempt {
  host: string;
  ms: number;
  /** Why it failed (network error code, HTTP status, timeout…); absent on success. */
  error?: string;
}

export class OverpassUnavailable extends Error {
  constructor(readonly attempts: Attempt[]) {
    super(
      attempts.length
        ? attempts.map((a) => `${a.host}: ${a.error}`).join("; ")
        : "no Overpass server to try",
    );
    this.name = "OverpassUnavailable";
  }
}

const COOL_OFF_MS = 5 * 60 * 1000;
/** The instance that answered last is tried first; failing ones wait a while at the back. */
let preferred: string | null = null;
const coolUntil = new Map<string, number>();

/** For tests: forget which instances worked or failed. */
export function resetOverpassState(): void {
  preferred = null;
  coolUntil.clear();
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** A short, loggable reason: undici hides the real cause (ECONNREFUSED, ENOTFOUND…) under "fetch failed". */
export function describeError(e: unknown): string {
  const err = e as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (err?.name === "TimeoutError") return "timeout";
  const cause = err?.cause?.code ?? err?.cause?.message;
  return (cause ? `${err?.message ?? "error"} (${cause})` : (err?.message ?? String(e))).slice(
    0,
    160,
  );
}

function order(urls: string[], now: number): string[] {
  const fresh = urls.filter((u) => (coolUntil.get(u) ?? 0) <= now);
  const cooling = urls.filter((u) => (coolUntil.get(u) ?? 0) > now);
  if (preferred && fresh.includes(preferred)) {
    fresh.splice(fresh.indexOf(preferred), 1);
    fresh.unshift(preferred);
  }
  return [...fresh, ...cooling];
}

/**
 * Run an Overpass query, failing over between instances within one time
 * budget. Throws `OverpassUnavailable` (with every attempt) if none answers,
 * or the caller's abort reason if the request was cancelled.
 */
export async function fetchOverpass(
  urls: string[],
  query: string,
  opts: {
    userAgent: string;
    signal?: AbortSignal;
    budgetMs?: number;
    perTryMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<{ data: OverpassResponse; attempts: Attempt[] }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const start = Date.now();
  const deadline = start + (opts.budgetMs ?? 45_000);
  const attempts: Attempt[] = [];
  for (const url of order([...new Set(urls)], start)) {
    const remaining = deadline - Date.now();
    if (remaining < 1500) break;
    opts.signal?.throwIfAborted();
    const t0 = Date.now();
    const timeout = AbortSignal.timeout(Math.min(opts.perTryMs ?? 25_000, remaining));
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
          "user-agent": opts.userAgent,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json().catch(() => null)) as
        (OverpassResponse & { remark?: string }) | null;
      if (!data || !Array.isArray(data.elements)) throw new Error("not Overpass JSON");
      // An overloaded instance can answer 200 with a runtime error and no data.
      if (!data.elements.length && /runtime error|timed out|out of memory/i.test(data.remark ?? ""))
        throw new Error(`remark: ${data.remark!.slice(0, 80)}`);
      attempts.push({ host: hostOf(url), ms: Date.now() - t0 });
      preferred = url;
      coolUntil.delete(url);
      return { data, attempts };
    } catch (e) {
      if (opts.signal?.aborted) throw opts.signal.reason ?? e;
      attempts.push({ host: hostOf(url), ms: Date.now() - t0, error: describeError(e) });
      coolUntil.set(url, Date.now() + COOL_OFF_MS);
    }
  }
  throw new OverpassUnavailable(attempts);
}
