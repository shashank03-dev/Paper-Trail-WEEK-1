import { afterEach, describe, expect, it } from "vitest";
import {
  isOpen,
  openUntil,
  recordFailure,
  recordSuccess,
  resetBreakers,
  retryAfterMs,
} from "@/lib/llm/breaker";
import { BusyError, createGate } from "@/lib/server/gate";
import { createChat } from "@/lib/llm/client";
import type { ProviderConfig } from "@/lib/config";

afterEach(() => resetBreakers());

describe("circuit breaker", () => {
  it("opens after two failures in a row and closes on success", () => {
    const now = 1_000_000;
    recordFailure("p", undefined, now);
    expect(isOpen("p", now)).toBe(false);
    recordFailure("p", undefined, now);
    expect(isOpen("p", now)).toBe(true);
    expect(openUntil("p")).toBe(now + 30_000);
    recordSuccess("p");
    expect(isOpen("p", now)).toBe(false);
  });

  it("backs off longer while failures continue, capped at two minutes", () => {
    const now = 0;
    for (let i = 0; i < 10; i++) recordFailure("p", undefined, now);
    expect(openUntil("p")).toBe(120_000);
  });

  it("honours Retry-After on a rate limit immediately", () => {
    recordFailure("p", 7_000, 50);
    expect(openUntil("p")).toBe(7_050);
    expect(retryAfterMs({ headers: new Headers({ "retry-after": "12" }) })).toBe(12_000);
    expect(retryAfterMs({ headers: { "retry-after": "3" } })).toBe(3_000);
    expect(retryAfterMs({})).toBeUndefined();
  });
});

describe("model gate", () => {
  it("runs at most `limit` calls at once and hands slots over in order", async () => {
    const g = createGate(2, 1_000);
    let running = 0;
    let peak = 0;
    const order: number[] = [];
    const job = (i: number) =>
      g.run(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((r) => setTimeout(r, 15));
        order.push(i);
        running--;
        return i;
      });
    const out = await Promise.all([1, 2, 3, 4, 5].map(job));
    expect(out).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
    expect(order.slice(0, 2).sort()).toEqual([1, 2]);
    expect(g.stats()).toEqual({ active: 0, queued: 0, limit: 2 });
  });

  it("fails fast with BusyError when the queue wait runs out", async () => {
    const g = createGate(1, 20);
    const slow = g.run(() => new Promise((r) => setTimeout(r, 80)));
    await expect(g.run(async () => 1)).rejects.toBeInstanceOf(BusyError);
    await slow;
    expect(g.stats().active).toBe(0);
  });

  it("drops a queued call when its request is aborted", async () => {
    const g = createGate(1, 1_000);
    const slow = g.run(() => new Promise((r) => setTimeout(r, 40)));
    const ac = new AbortController();
    const queued = g.run(async () => 1, ac.signal);
    ac.abort();
    await expect(queued).rejects.toThrow("aborted");
    await slow;
    expect(g.stats()).toEqual({ active: 0, queued: 0, limit: 1 });
  });
});

describe("provider chain with a breaker", () => {
  const base: Omit<ProviderConfig, "id" | "baseURL"> = {
    label: "x",
    apiKey: "k",
    modelText: "m",
    modelVision: "m",
    jsonSchema: true,
    systemRole: true,
    native: false,
    hosted: true,
  };

  it("skips a provider that keeps failing instead of waiting on it every time", async () => {
    // Port 9 (discard) refuses connections: a fast, retryable network error.
    const dead = { ...base, id: "gemini" as const, baseURL: "http://127.0.0.1:9/v1" };
    const alsoDead = { ...base, id: "ollama-cloud" as const, baseURL: "http://127.0.0.1:9/v2" };
    const chat = createChat({
      providers: [dead, alsoDead],
      baseURL: dead.baseURL,
      modelText: "m",
      modelVision: "m",
      timeoutMs: 2_000,
    });
    const req = { model: "m", messages: [{ role: "user" as const, content: "hi" }] };
    await expect(chat(req)).rejects.toBeTruthy();
    await expect(chat(req)).rejects.toBeTruthy();
    // Both circuits are open now; the chain still tries the one that recovers first.
    expect(isOpen(`gemini|${dead.baseURL}`)).toBe(true);
    expect(isOpen(`ollama-cloud|${alsoDead.baseURL}`)).toBe(true);
    await expect(chat(req)).rejects.toBeTruthy();
  });
});

describe("printed copy never shows internal ids", () => {
  it("flags OSM-style feature ids and waypoint tags, and nothing else", async () => {
    const { idLeaks } = await import("@/lib/writer/grounding");
    expect(idLeaks(["Start at the drinking fountain n9000024."])[0]).toMatch(/n9000024/);
    expect(idLeaks(["At W6, stand still."])[0]).toMatch(/W6/);
    expect(idLeaks(["91 m W, hug it", "Walk 2 min to the bandstand", "W. 4th Street"])).toEqual([]);
  });
});

describe("daily model budget", () => {
  it("allows the limit, then fails fast; 0 is a kill switch; off disables it", async () => {
    const { BudgetError, createBudget } = await import("@/lib/server/chat");
    const b = createBudget("3");
    b.take();
    b.take();
    b.take();
    expect(() => b.take()).toThrow(BudgetError);
    expect(b.stats()).toEqual({ used: 3, limit: 3 });
    expect(() => createBudget("0").take()).toThrow(BudgetError);
    const off = createBudget("off");
    for (let i = 0; i < 5000; i++) off.take();
    expect(off.stats().limit).toBeNull();
    expect(createBudget("").stats().limit).toBe(2000);
    expect(createBudget("2k").stats().limit).toBe(2000);
  });
});
