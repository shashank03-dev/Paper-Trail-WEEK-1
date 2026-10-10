/**
 * Request IDs and one structured log line per request. Logs carry the route,
 * status, timings and which generation path ran (llm / llm-retry / fallback /
 * replay), never coordinates, photos, handwriting or keys.
 */
export function requestId(req: Request): string {
  const given = req.headers.get("x-request-id");
  return given && /^[\w-]{6,64}$/.test(given) ? given : crypto.randomUUID().slice(0, 12);
}

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function logLine(fields: LogFields): void {
  if (process.env.NODE_ENV === "test") return;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  console.log(JSON.stringify({ t: new Date().toISOString(), ...clean }));
}
