import { z } from "zod";
import {
  BackCopySchema,
  CoverCopySchema,
  IspyItemSchema,
  ListenCopySchema,
  RiddleSchema,
  RouteCopySchema,
  TrailPlanSchema,
  LIMITS,
  type CopyPanel,
  type GenPath,
  type PlanPanel,
  type TrailPlan,
  type WriterContext,
  type Panels,
} from "@/lib/schemas";
import { chatJSON, LlmJsonError } from "@/lib/llm/json";
import type { Chat, ChatOptions } from "@/lib/llm/types";
import * as P from "@/lib/prompts/writer";
import {
  backProblems,
  coverProblems,
  ispyProblems,
  listenProblems,
  planProblems,
  riddleProblems,
  routeCopyProblems,
  scrubWaypointTags as scrub,
} from "./grounding";
import {
  fallbackBack,
  fallbackCover,
  fallbackIspy,
  fallbackListen,
  fallbackPlan,
  fallbackRiddle,
  fallbackRoute,
  fallbackSketch,
} from "./fallback";
import { fitsEverywhere } from "@/lib/zine/boxes";

export interface GenMeta {
  path: GenPath;
  attempts: number;
  ms: number;
  tokens: number;
  problems: string[];
}

export interface Writer {
  chat: Chat;
  model: string;
  log?: (event: string, data: Record<string, unknown>) => void;
}

function logPath(w: Writer, task: string, meta: GenMeta) {
  (w.log ?? defaultLog)("writer", {
    task,
    path: meta.path,
    attempts: meta.attempts,
    ms: meta.ms,
    problems: meta.problems.slice(0, 3),
  });
}
function defaultLog(event: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "test") console.info(`[paper-trail] ${event}`, JSON.stringify(data));
}

async function withFallback<T>(
  w: Writer,
  task: string,
  run: () => Promise<{
    value: T;
    attempts: number;
    path: "llm" | "llm-retry";
    ms: number;
    tokens: number;
    fixed: string[];
  }>,
  fallback: () => T,
): Promise<{ value: T; meta: GenMeta }> {
  try {
    const r = await run();
    const meta: GenMeta = {
      path: r.path,
      attempts: r.attempts,
      ms: r.ms,
      tokens: r.tokens,
      problems: r.fixed,
    };
    logPath(w, task, meta);
    return { value: r.value, meta };
  } catch (e) {
    const problems =
      e instanceof LlmJsonError ? e.problems : [String((e as Error).message ?? e).slice(0, 160)];
    const meta: GenMeta = {
      path: "fallback",
      attempts: e instanceof LlmJsonError ? e.attempts : 1,
      ms: 0,
      tokens: 0,
      problems,
    };
    logPath(w, task, meta);
    return { value: fallback(), meta };
  }
}

/** Stage 1: the plan (one structured call, grounded, never dead-ends). */
export async function generatePlan(
  w: Writer,
  ctx: WriterContext,
  opts?: ChatOptions,
): Promise<{ plan: TrailPlan; meta: GenMeta }> {
  const pr = P.planPrompt(ctx);
  const { value, meta } = await withFallback(
    w,
    "plan",
    () =>
      chatJSON({
        chat: w.chat,
        model: w.model,
        name: "trail_plan",
        system: pr.system,
        user: pr.user,
        schema: TrailPlanSchema,
        temperature: pr.temperature,
        maxTokens: 1600,
        validate: (p) => planProblems(p, ctx),
        opts,
      }),
    () => fallbackPlan(ctx),
  );
  return { plan: value, meta };
}

const IspyOnly = z.object({ ispy: z.array(IspyItemSchema).min(8).max(10) });
const SketchOnly = z.object({ sketchPrompt: z.string().min(5).max(LIMITS.sketchPrompt) });

/** Re-roll one part of the plan. Returns the updated plan. */
export async function regeneratePlanPart(
  w: Writer,
  part: PlanPanel,
  ctx: WriterContext,
  plan: TrailPlan,
): Promise<{ plan: TrailPlan; meta: GenMeta }> {
  if (part === "ispy") {
    const pr = P.ispyPrompt(ctx, plan);
    const r = await withFallback(
      w,
      "ispy",
      () =>
        chatJSON({
          chat: w.chat,
          model: w.model,
          name: "ispy",
          system: pr.system,
          user: pr.user,
          schema: IspyOnly,
          temperature: pr.temperature,
          validate: (v) => ispyProblems(v.ispy, ctx),
        }),
      () => ({ ispy: fallbackIspy(ctx) }),
    );
    return { plan: { ...plan, ispy: r.value.ispy }, meta: r.meta };
  }
  if (part === "riddle") {
    const pr = P.riddlePrompt(ctx, plan);
    const r = await withFallback(
      w,
      "riddle",
      () =>
        chatJSON({
          chat: w.chat,
          model: w.model,
          name: "riddle",
          system: pr.system,
          user: pr.user,
          schema: RiddleSchema,
          temperature: pr.temperature,
          validate: (v) => riddleProblems(v, ctx),
        }),
      () => fallbackRiddle(ctx),
    );
    return { plan: { ...plan, riddle: r.value }, meta: r.meta };
  }
  const pr = P.sketchPrompt(ctx, plan);
  const r = await withFallback(
    w,
    "sketch",
    () =>
      chatJSON({
        chat: w.chat,
        model: w.model,
        name: "sketch",
        system: pr.system,
        user: pr.user,
        schema: SketchOnly,
        temperature: pr.temperature,
        validate: (v) =>
          fitsEverywhere("sketchPrompt", v.sketchPrompt) ? [] : ["sketchPrompt too long"],
      }),
    () => ({ sketchPrompt: fallbackSketch(ctx) }),
  );
  return { plan: { ...plan, sketchPrompt: r.value.sketchPrompt }, meta: r.meta };
}

/** Stage 2: one panel's copy. */
export type PanelCopy = NonNullable<Panels[CopyPanel]>;

export async function generatePanel(
  w: Writer,
  panel: CopyPanel,
  ctx: WriterContext,
  plan: TrailPlan,
): Promise<{ value: PanelCopy; meta: GenMeta }> {
  const call = <T>(
    pr: P.PromptPair,
    schema: z.ZodType<T>,
    validate: (v: T) => string[],
    fb: () => T,
    repair?: (v: T) => T,
  ) =>
    withFallback(
      w,
      pr.task,
      () =>
        chatJSON({
          chat: w.chat,
          model: w.model,
          name: pr.task,
          system: pr.system,
          user: pr.user,
          schema,
          temperature: pr.temperature,
          maxTokens: 900,
          validate,
          repair,
        }),
      fb,
    );
  switch (panel) {
    case "cover":
      return call(
        P.coverPrompt(ctx, plan),
        CoverCopySchema,
        coverProblems,
        () => fallbackCover(ctx),
        (v) => ({ ...v, kicker: scrub(v.kicker), blurb: scrub(v.blurb) }),
      );
    case "route":
      return call(
        P.routePrompt(ctx, plan),
        RouteCopySchema,
        (v) => routeCopyProblems(v, ctx),
        () => fallbackRoute(ctx),
        (v) => ({
          ...v,
          stops: v.stops.map((s) => ({ ...s, text: scrub(s.text) })),
          ifLost: { ...v.ifLost, text: scrub(v.ifLost.text) },
        }),
      );
    case "listen":
      return call(
        P.listenPrompt(ctx, plan),
        ListenCopySchema,
        listenProblems,
        () => fallbackListen(ctx, plan),
        (v) => ({ ...v, intro: scrub(v.intro) }),
      );
    default:
      return call(
        P.backPrompt(ctx, plan),
        BackCopySchema,
        backProblems,
        () => fallbackBack(),
        (v) => ({ ...v, blurb: scrub(v.blurb) }),
      );
  }
}
