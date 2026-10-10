/**
 * A small circuit breaker per model provider. When a provider keeps failing
 * (rate limits, 5xx, timeouts) it is skipped for a cool-down instead of making
 * every request wait for it to fail again; the provider chain moves straight on
 * to the next one. A success closes the circuit.
 */

export interface BreakerState {
  failures: number;
  openUntil: number;
}

const FAIL_THRESHOLD = 2;
const BASE_COOLDOWN_MS = 30_000;
const MAX_COOLDOWN_MS = 120_000;

const states = new Map<string, BreakerState>();

function state(key: string): BreakerState {
  let s = states.get(key);
  if (!s) states.set(key, (s = { failures: 0, openUntil: 0 }));
  return s;
}

/** Is this provider currently being skipped? */
export function isOpen(key: string, now = Date.now()): boolean {
  return state(key).openUntil > now;
}

/** When the circuit closes again (0 if closed). */
export function openUntil(key: string): number {
  return state(key).openUntil;
}

export function recordSuccess(key: string): void {
  const s = state(key);
  s.failures = 0;
  s.openUntil = 0;
}

/**
 * Record a failure. A 429 with Retry-After opens the circuit at once for that
 * long; otherwise it opens after FAIL_THRESHOLD failures in a row, with the
 * cool-down doubling while failures continue.
 */
export function recordFailure(key: string, retryAfterMs?: number, now = Date.now()): void {
  const s = state(key);
  s.failures += 1;
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    s.openUntil = now + Math.min(MAX_COOLDOWN_MS, retryAfterMs);
    return;
  }
  if (s.failures >= FAIL_THRESHOLD) {
    const n = s.failures - FAIL_THRESHOLD;
    s.openUntil = now + Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** n);
  }
}

/** Retry-After from an OpenAI-SDK style error, in ms (seconds or an HTTP date). */
export function retryAfterMs(e: unknown, now = Date.now()): number | undefined {
  const headers = (e as { headers?: Headers | Record<string, string> }).headers;
  const raw =
    headers instanceof Headers
      ? headers.get("retry-after")
      : (headers as Record<string, string> | undefined)?.["retry-after"];
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return secs * 1000;
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

/** For tests. */
export function resetBreakers(): void {
  states.clear();
}
