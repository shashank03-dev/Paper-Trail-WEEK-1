"use client";

let sent = 0;
const seen = new Set<string>();

/** Tell the server a page broke (deduplicated, at most 5 reports per page load). */
export function reportError(
  kind: "render" | "runtime" | "promise" | "global",
  error: unknown,
  digest?: string,
): void {
  try {
    const message = String((error as Error)?.message ?? error ?? "unknown").slice(0, 300);
    const key = `${kind}:${message}`;
    if (seen.has(key) || sent >= 5) return;
    seen.add(key);
    sent++;
    const body = JSON.stringify({
      kind,
      message,
      ...(digest ? { digest: digest.slice(0, 64) } : {}),
      path: location.pathname.slice(0, 200),
    });
    if (navigator.sendBeacon?.("/api/client-error", new Blob([body], { type: "application/json" })))
      return;
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* reporting must never break the page */
  }
}
