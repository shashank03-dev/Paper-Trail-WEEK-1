"use client";
import { llmHeaders } from "./settings";

export async function postJSON<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...llmHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
  return j as T;
}

/** POST and read a text/event-stream response, calling onEvent for each `data:` JSON payload. */
export async function postSSE(
  url: string,
  body: unknown,
  onEvent: (e: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...llmHeaders() },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (line) onEvent(JSON.parse(line.slice(5)));
    }
  }
}

export interface PublicConfig {
  modelText: string;
  modelVision: string;
  endpoint: string;
  endpointLabel: string;
  deviceLabel: string;
  publicUrl: string;
  repoUrl: string;
  demoMode: boolean;
  allowEndpointOverride: boolean;
}

let cfg: Promise<PublicConfig> | null = null;
export function getConfig(): Promise<PublicConfig> {
  if (!cfg)
    cfg = fetch("/api/config", { headers: llmHeaders() }).then(
      (r) => r.json() as Promise<PublicConfig>,
    );
  return cfg;
}
