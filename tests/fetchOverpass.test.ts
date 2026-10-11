import { beforeEach, describe, expect, it } from "vitest";
import {
  OverpassUnavailable,
  describeError,
  fetchOverpass,
  resetOverpassState,
  setRetryBaseMs,
} from "@/lib/places/fetchOverpass";

const A = "https://a.example/api/interpreter";
const B = "https://b.example/api/interpreter";
const C = "https://c.example/api/interpreter";
const ok = (elements: unknown[] = [{ type: "node", id: 1, lat: 0, lon: 0 }]) =>
  new Response(JSON.stringify({ elements }), { headers: { "content-type": "application/json" } });
/** What undici throws when a host refuses the connection. */
const refused = () =>
  Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });

/** A fake fetch: each host answers with its handler; records the order hosts were asked. */
function fake(handlers: Record<string, () => Response | Promise<Response>>) {
  const asked: string[] = [];
  const impl = (async (url: string | URL | Request) => {
    const u = String(url);
    asked.push(new URL(u).host);
    const h = handlers[u];
    if (!h) throw refused();
    return h();
  }) as typeof fetch;
  return { impl, asked };
}
const opts = (impl: typeof fetch) => ({ userAgent: "test", fetchImpl: impl, budgetMs: 10_000 });

describe("Overpass failover", () => {
  beforeEach(() => {
    resetOverpassState();
    setRetryBaseMs(20);
  });

  it("moves on when a server refuses the connection, and says why", async () => {
    const f = fake({ [B]: () => ok() });
    const r = await fetchOverpass([A, B], "q", opts(f.impl));
    expect(r.data.elements).toHaveLength(1);
    expect(f.asked).toEqual(["a.example", "b.example"]);
    expect(r.attempts[0]!.error).toBe("fetch failed (ECONNREFUSED)");
    expect(r.attempts[1]!.error).toBeUndefined();
  });

  it("treats rate limits, gateway errors, HTML and runtime-error remarks as failures", async () => {
    const f = fake({
      [A]: () => new Response("slow down", { status: 429 }),
      [B]: () => new Response("<html>504</html>", { status: 200 }),
      [C]: () => ok(),
    });
    const r = await fetchOverpass([A, B, C], "q", opts(f.impl));
    expect(r.attempts.map((a) => a.error)).toEqual(["HTTP 429", "not Overpass JSON", undefined]);

    resetOverpassState();
    const g = fake({
      [A]: () =>
        new Response(JSON.stringify({ elements: [], remark: "runtime error: Query timed out" })),
      [B]: () => ok(),
    });
    const s = await fetchOverpass([A, B], "q", opts(g.impl));
    expect(s.attempts[0]!.error).toMatch(/^remark: runtime error/);
  });

  it("accepts an honest empty answer (a place with nothing mapped)", async () => {
    const f = fake({ [A]: () => ok([]) });
    const r = await fetchOverpass([A, B], "q", opts(f.impl));
    expect(r.data.elements).toEqual([]);
    expect(f.asked).toEqual(["a.example"]);
  });

  it("asks the server that answered last first, and puts failing ones at the back", async () => {
    const first = fake({ [B]: () => ok() });
    await fetchOverpass([A, B, C], "q", opts(first.impl));
    const second = fake({ [B]: () => ok() });
    await fetchOverpass([A, B, C], "q", opts(second.impl));
    expect(second.asked).toEqual(["b.example"]);
  });

  it("throws every attempt when no server answers", async () => {
    const f = fake({});
    const e = await fetchOverpass([A, B, A], "q", opts(f.impl)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(OverpassUnavailable);
    // Duplicates are asked once.
    expect((e as OverpassUnavailable).attempts.map((a) => a.host)).toEqual([
      "a.example",
      "b.example",
    ]);
    expect((e as Error).message).toContain("ECONNREFUSED");
  });

  it("stops at once when the caller goes away", async () => {
    const ctl = new AbortController();
    const f = fake({
      [A]: () => {
        ctl.abort(new Error("client left"));
        throw new DOMException("aborted", "AbortError");
      },
      [B]: () => ok(),
    });
    await expect(
      fetchOverpass([A, B], "q", { ...opts(f.impl), signal: ctl.signal }),
    ).rejects.toThrow("client left");
    expect(f.asked).toEqual(["a.example"]);
  });

  it("asks the next server when one is slow, takes the first answer, and cancels the rest", async () => {
    let slowAborted = false;
    const slow = (signal: AbortSignal) =>
      new Promise<Response>((res, rej) => {
        const t = setTimeout(() => res(ok()), 2000);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          slowAborted = true;
          rej(new DOMException("aborted", "AbortError"));
        });
      });
    const asked: string[] = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      asked.push(new URL(String(url)).host);
      if (String(url) === A) return slow(init!.signal!);
      return ok([{ type: "node", id: 2, lat: 0, lon: 0 }]);
    }) as typeof fetch;
    const t0 = Date.now();
    const r = await fetchOverpass([A, B, C], "q", { ...opts(impl), hedgeMs: 50 });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(r.data.elements[0]).toMatchObject({ id: 2 });
    expect(asked).toEqual(["a.example", "b.example"]);
    expect(r.attempts).toEqual([{ host: "b.example", ms: expect.any(Number) }]);
    expect(slowAborted).toBe(true);

    // The slow one was cancelled, not failed: it isn't cooled off. (B answered, so it leads.)
    const next = fake({ [B]: () => new Response("", { status: 500 }), [A]: () => ok() });
    await fetchOverpass([A, B, C], "q", { ...opts(next.impl), hedgeMs: 5000 });
    expect(next.asked).toEqual(["b.example", "a.example"]);
  });

  it("retries servers that flap (500s), but not ones that refuse: the live outage", async () => {
    // As seen on the live site: the main server refuses, two mirrors answer 500
    // for a moment, the last one hangs. The mirror that recovers must win.
    const D = "https://d.example/api/interpreter";
    let flaps = 0;
    const asked: string[] = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      asked.push(new URL(u).host);
      if (u === A) throw refused();
      if (u === B) return ++flaps < 3 ? new Response("down", { status: 500 }) : ok();
      if (u === C) return new Response("down", { status: 500 });
      return new Promise<Response>((_, rej) =>
        init!.signal!.addEventListener("abort", () => rej(new DOMException("t", "TimeoutError"))),
      );
    }) as typeof fetch;
    const r = await fetchOverpass([A, B, C, D], "q", { ...opts(impl), hedgeMs: 5000 });
    expect(r.attempts.at(-1)).toEqual({ host: "b.example", ms: expect.any(Number) });
    // The refusing server was asked once; the flapping one until it recovered.
    expect(asked.filter((h) => h === "a.example")).toHaveLength(1);
    expect(asked.filter((h) => h === "b.example")).toHaveLength(3);
  });

  it("gives up within the budget when every server keeps failing", async () => {
    const f = fake({
      [A]: () => new Response("down", { status: 502 }),
      [B]: () => new Response("down", { status: 503 }),
    });
    const t0 = Date.now();
    const e = await fetchOverpass([A, B], "q", { ...opts(f.impl), budgetMs: 3000 }).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(OverpassUnavailable);
    expect(Date.now() - t0).toBeLessThan(3000);
    // Three tries each, then it stops.
    expect(f.asked).toHaveLength(6);
  });

  it("retries servers that flap (500s), but not ones that refuse: the live outage", async () => {
    // As seen on the live site: the main server refuses, two mirrors answer 500
    // for a moment, the last one hangs. The mirror that recovers must win.
    const D = "https://d.example/api/interpreter";
    let flaps = 0;
    const asked: string[] = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      asked.push(new URL(u).host);
      if (u === A) throw refused();
      if (u === B) return ++flaps < 3 ? new Response("down", { status: 500 }) : ok();
      if (u === C) return new Response("down", { status: 500 });
      return new Promise<Response>((_, rej) =>
        init!.signal!.addEventListener("abort", () => rej(new DOMException("t", "TimeoutError"))),
      );
    }) as typeof fetch;
    const r = await fetchOverpass([A, B, C, D], "q", { ...opts(impl), hedgeMs: 5000 });
    expect(r.attempts.at(-1)).toEqual({ host: "b.example", ms: expect.any(Number) });
    expect(asked.filter((h) => h === "a.example")).toHaveLength(1);
    expect(asked.filter((h) => h === "b.example")).toHaveLength(3);
  });

  it("gives up within the budget when every server keeps failing", async () => {
    const f = fake({
      [A]: () => new Response("down", { status: 502 }),
      [B]: () => new Response("down", { status: 503 }),
    });
    const t0 = Date.now();
    const e = await fetchOverpass([A, B], "q", { ...opts(f.impl), budgetMs: 3000 }).catch(
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(OverpassUnavailable);
    expect(Date.now() - t0).toBeLessThan(3000);
    // Three tries each, then it stops.
    expect(f.asked).toHaveLength(6);
  });

  it("names timeouts plainly", () => {
    expect(describeError(new DOMException("t", "TimeoutError"))).toBe("timeout");
  });
});
