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
/** Each server gets up to this many tries per request, for transient failures only. */
const MAX_TRIES = 3;
let RETRY_BASE_MS = 800;
/** For tests: shorten the wait before a retry. */
export function setRetryBaseMs(ms: number): void {
  RETRY_BASE_MS = ms;
}
/** Overload, rate limits, gateway errors and timeouts pass; refused or unknown hosts don't. */
const transient = (error: string) =>
  /^HTTP (5\d\d|429)|timeout|^remark:|not Overpass JSON|ECONNRESET|UND_ERR_SOCKET|terminated/.test(
    error,
  );
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
 * Run an Overpass query across instances within one time budget. A server
 * that fails is replaced at once; one that is merely slow gets a head start
 * of `hedgeMs`, then the next is asked alongside it and the first good answer
 * wins (the others are cancelled, and not held against them). Throws
 * `OverpassUnavailable` (with every attempt) if none answers, or the caller's
 * abort reason if the request was cancelled.
 */
export function fetchOverpass(
  urls: string[],
  query: string,
  opts: {
    userAgent: string;
    signal?: AbortSignal;
    budgetMs?: number;
    perTryMs?: number;
    hedgeMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<{ data: OverpassResponse; attempts: Attempt[] }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const start = Date.now();
  const deadline = start + (opts.budgetMs ?? 45_000);
  const hedgeMs = opts.hedgeMs ?? 5000;
  const queue = order([...new Set(urls)], start);
  const attempts: Attempt[] = [];

  const ask = async (url: string, signal: AbortSignal): Promise<OverpassResponse> => {
    const res = await doFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
        "user-agent": opts.userAgent,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json().catch(() => null)) as
      (OverpassResponse & { remark?: string }) | null;
    if (!data || !Array.isArray(data.elements)) throw new Error("not Overpass JSON");
    // An overloaded instance can answer 200 with a runtime error and no data.
    if (!data.elements.length && /runtime error|timed out|out of memory/i.test(data.remark ?? ""))
      throw new Error(`remark: ${data.remark!.slice(0, 80)}`);
    return data;
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    let running = 0;
    const live = new Set<AbortController>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      live.forEach((c) => c.abort());
      opts.signal?.removeEventListener("abort", onAbort);
      fn();
    };
    const onAbort = () =>
      finish(() => reject(opts.signal!.reason ?? new DOMException("aborted", "AbortError")));
    if (opts.signal?.aborted) return onAbort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    const tries = new Map<string, number>();
    let waiting = 0; // retries scheduled but not yet re-queued
    const launch = () => {
      if (settled) return;
      const remaining = deadline - Date.now();
      const url = remaining >= 1500 ? queue.shift() : undefined;
      if (!url) {
        if (running === 0 && (waiting === 0 || remaining < 1500))
          finish(() => reject(new OverpassUnavailable(attempts)));
        return;
      }
      tries.set(url, (tries.get(url) ?? 0) + 1);
      running++;
      const ctl = new AbortController();
      live.add(ctl);
      const t0 = Date.now();
      const signal = AbortSignal.any([
        ctl.signal,
        AbortSignal.timeout(Math.min(opts.perTryMs ?? 25_000, remaining)),
      ]);
      // Slow but not failed: ask the next server too.
      const hedge = setTimeout(launch, hedgeMs);
      timers.add(hedge);
      ask(url, signal).then(
        (data) => {
          if (settled) return;
          attempts.push({ host: hostOf(url), ms: Date.now() - t0 });
          preferred = url;
          coolUntil.delete(url);
          finish(() => resolve({ data, attempts }));
        },
        (e) => {
          running--;
          live.delete(ctl);
          clearTimeout(hedge);
          timers.delete(hedge);
          if (settled) return;
          const error = describeError(e);
          attempts.push({ host: hostOf(url), ms: Date.now() - t0, error });
          coolUntil.set(url, Date.now() + COOL_OFF_MS);
          // Public instances flap: a 500 or a timeout often clears in a second
          // or two, so try it again later in this same request. A refused
          // connection or an unknown host won't, so those are not retried.
          const n = tries.get(url)!;
          if (transient(error) && n < MAX_TRIES) {
            waiting++;
            const t = setTimeout(
              () => {
                timers.delete(t);
                waiting--;
                queue.push(url);
                launch();
              },
              Math.min(RETRY_BASE_MS * 2 ** (n - 1), 4000),
            );
            timers.add(t);
          }
          launch();
        },
      );
    };
    launch();
  });
}
