import { describe, expect, it } from "vitest";
import { chatJSON, extractJson, LlmJsonError } from "@/lib/llm/json";
import { mockChat, parseFeatures } from "@/lib/llm/mock";
import { generatePanel, generatePlan, regeneratePlanPart } from "@/lib/writer/generate";
import {
  ispyProblems,
  planProblems,
  riddleProblems,
  scrubWaypointTags,
} from "@/lib/writer/grounding";
import { fallbackPlan, fallbackRoute } from "@/lib/writer/fallback";
import { planPrompt } from "@/lib/prompts/writer";
import { TrailPlanSchema, RouteCopySchema } from "@/lib/schemas";
import { z } from "zod";
import { presetContext } from "./helpers";

const quiet = { log: () => {} };

describe("JSON extraction", () => {
  it("handles fences and preambles", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":[1,2]} hope that helps')).toEqual({ a: [1, 2] });
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("chatJSON retry loop", () => {
  const schema = z.object({ title: z.string(), n: z.number() });
  it("retries with the error appended, then succeeds", async () => {
    let calls = 0;
    const seen: string[] = [];
    const chat = async (req: Parameters<ReturnType<typeof mockChat>>[0]) => {
      calls++;
      seen.push(JSON.stringify(req.messages.at(-1)));
      return { content: calls === 1 ? '{"title": "oops"' : '{"title":"ok","n":2}', ms: 1 };
    };
    const r = await chatJSON({ chat, model: "m", name: "t", system: "s", user: "u", schema });
    expect(r.value).toEqual({ title: "ok", n: 2 });
    expect(r.path).toBe("llm-retry");
    expect(r.attempts).toBe(2);
    expect(seen[1]).toContain("Your last JSON failed");
  });
  it("gives up after 3 attempts with the problems", async () => {
    const chat = async () => ({ content: '{"title": 5}', ms: 1 });
    await expect(
      chatJSON({ chat, model: "m", name: "t", system: "s", user: "u", schema }),
    ).rejects.toBeInstanceOf(LlmJsonError);
  });
  it("runs semantic validation and retries on it", async () => {
    let calls = 0;
    const chat = async () => ({ content: JSON.stringify({ title: "x", n: ++calls }), ms: 1 });
    const r = await chatJSON({
      chat,
      model: "m",
      name: "t",
      system: "s",
      user: "u",
      schema,
      validate: (v) => (v.n < 2 ? ["n too small"] : []),
    });
    expect(r.value.n).toBe(2);
  });
});

describe("prompts", () => {
  it("passes features as compact id lines the model (and mock) can ground on", () => {
    const { ctx } = presetContext(2);
    const p = planPrompt(ctx);
    expect(p.user).toMatch(/^TASK: plan/);
    expect(p.temperature).toBe(0.2);
    const feats = parseFeatures(p.user);
    expect(feats.filter((f) => f.waypoint)).toHaveLength(ctx.route.waypoints.length);
    expect(p.user).toContain('"Golden Fire Hydrant"');
  });
  it("adapts to weather and companions", () => {
    const wet = presetContext(1).ctx; // Vondelpark fixture: drizzle
    expect(planPrompt(wet).user).toContain("puddle edition");
    const dog = presetContext(0, { companions: "dog" }).ctx;
    expect(planPrompt(dog).user).toContain("sniff");
    const kids = presetContext(0, { companions: "kids" }).ctx;
    expect(planPrompt(kids).user).toContain("Ask a grown-up");
  });
});

describe("grounding", () => {
  const { ctx } = presetContext(2);
  it("accepts the deterministic fallback", () => {
    const plan = fallbackPlan(ctx);
    expect(TrailPlanSchema.safeParse(plan).success).toBe(true);
    expect(planProblems(plan, ctx)).toEqual([]);
  });
  it("flags hallucinated ids, too few grounded items and a non-waypoint riddle", () => {
    const plan = fallbackPlan(ctx);
    const bad = plan.ispy.map((i) => ({ ...i, featureId: i.featureId ? "n424242" : null }));
    const p = ispyProblems(bad, ctx);
    expect(p.join(" ")).toContain("not in the list");
    expect(p.join(" ")).toContain("grounded");
    const nonWaypoint = ctx.features.find(
      (f) => !ctx.route.waypoints.some((w) => w.featureId === f.id),
    )!;
    expect(
      riddleProblems({ ...plan.riddle, targetFeatureId: nonWaypoint.id }, ctx).join(" "),
    ).toContain("WAYPOINT");
  });
});

describe("waypoint tags", () => {
  it("become the stop numbers printed on the map, capitalised at a sentence start", () => {
    expect(scrubWaypointTags("W1 is a bench. Then head to W12 (by W3).")).toBe(
      "Stop 1 is a bench. Then head to stop 12 (by stop 3).",
    );
    expect(scrubWaypointTags("Walk 2 minutes west; n90012 stays")).toBe(
      "Walk 2 minutes west; n90012 stays",
    );
  });
});

describe("generation never dead-ends", () => {
  const { ctx } = presetContext(2);
  it("uses the model when it behaves", async () => {
    const r = await generatePlan({ chat: mockChat(), model: "gemma4:e4b", ...quiet }, ctx);
    expect(r.meta.path).toBe("llm");
    expect(planProblems(r.plan, ctx)).toEqual([]);
  });
  it("recovers from broken JSON on retry", async () => {
    const r = await generatePlan({ chat: mockChat({ brokenTimes: 1 }), model: "m", ...quiet }, ctx);
    expect(r.meta.path).toBe("llm-retry");
  });
  it("recovers from hallucinated feature ids on retry", async () => {
    const r = await generatePlan(
      { chat: mockChat({ brokenTimes: 1, groundingBreaker: true }), model: "m", ...quiet },
      ctx,
    );
    expect(r.meta.path).toBe("llm-retry");
    expect(r.meta.problems.join(" ")).toContain("not in the list");
  });
  it("falls back to the template when the model keeps failing", async () => {
    const r = await generatePlan(
      { chat: mockChat({ brokenTimes: 99 }), model: "m", ...quiet },
      ctx,
    );
    expect(r.meta.path).toBe("fallback");
    expect(planProblems(r.plan, ctx)).toEqual([]);
  });
  it("falls back when the endpoint is down", async () => {
    const r = await generatePanel(
      { chat: mockChat({ fail: true }), model: "m", ...quiet },
      "route",
      ctx,
      fallbackPlan(ctx),
    );
    expect(r.meta.path).toBe("fallback");
    expect(RouteCopySchema.parse(r.value)).toEqual(fallbackRoute(ctx));
  });
  it("turns waypoint tags into stop numbers instead of spending a retry", async () => {
    let calls = 0;
    const chat = async () => {
      calls++;
      return { content: JSON.stringify({ intro: "W2: stand still at W2 and listen." }), ms: 1 };
    };
    const r = await generatePanel({ chat, model: "m", ...quiet }, "listen", ctx, fallbackPlan(ctx));
    expect(calls).toBe(1);
    expect(r.meta.path).toBe("llm");
    expect(r.value).toEqual({ intro: "Stop 2: stand still at stop 2 and listen." });
  });
  it("writes every copy panel and re-rolls plan parts", async () => {
    const plan = (await generatePlan({ chat: mockChat(), model: "m", ...quiet }, ctx)).plan;
    for (const p of ["cover", "route", "listen", "back"] as const) {
      const r = await generatePanel({ chat: mockChat(), model: "m", ...quiet }, p, ctx, plan);
      expect(r.meta.path).toBe("llm");
    }
    const rr = await regeneratePlanPart(
      { chat: mockChat(), model: "m", ...quiet },
      "ispy",
      ctx,
      plan,
    );
    expect(rr.plan.ispy).not.toEqual(plan.ispy);
    expect(rr.plan.title).toBe(plan.title);
  });
});
