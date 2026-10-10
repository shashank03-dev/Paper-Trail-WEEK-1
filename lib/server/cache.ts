import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DAY = 24 * 60 * 60 * 1000;
const mem = new Map<string, { at: number; value: unknown }>();
/** Identical lookups that arrive together share one upstream request. */
const inflight = new Map<string, Promise<unknown>>();
const MAX = 200;

/** In-memory LRU + on-disk JSON cache in .cache/ (24 h by default), with single-flight. */
export async function cached<T>(
  ns: string,
  key: string,
  fn: () => Promise<T>,
  ttl = DAY,
): Promise<T> {
  const k = `${ns}:${createHash("sha1").update(key).digest("hex").slice(0, 20)}`;
  const hit = mem.get(k);
  if (hit && Date.now() - hit.at < ttl) {
    mem.delete(k);
    mem.set(k, hit);
    return hit.value as T;
  }
  const file = join(process.cwd(), ".cache", `${k.replace(":", "-")}.json`);
  try {
    const disk = JSON.parse(await readFile(file, "utf8")) as { at: number; value: T };
    if (Date.now() - disk.at < ttl) {
      remember(k, disk);
      return disk.value;
    }
  } catch {
    /* miss */
  }
  const pending = inflight.get(k) as Promise<T> | undefined;
  if (pending) return pending;
  const run = fn();
  inflight.set(k, run);
  let value: T;
  try {
    value = await run;
  } finally {
    inflight.delete(k);
  }
  const entry = { at: Date.now(), value };
  remember(k, entry);
  try {
    await mkdir(join(process.cwd(), ".cache"), { recursive: true });
    await writeFile(file, JSON.stringify(entry));
  } catch {
    /* read-only filesystem: memory cache only */
  }
  return value;
}

function remember(k: string, v: { at: number; value: unknown }) {
  mem.set(k, v);
  while (mem.size > MAX) mem.delete(mem.keys().next().value!);
}
