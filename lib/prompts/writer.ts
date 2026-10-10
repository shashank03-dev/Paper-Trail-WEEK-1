import type { TrailPlan, WriterContext } from "@/lib/schemas";
import { LIMITS } from "@/lib/schemas";
import { contextBlock, WRITER_SYSTEM } from "./shared";

export interface PromptPair {
  task: string;
  system: string;
  user: string;
  temperature: number;
}

/** Stage 1: the plan. Low temperature for structure. */
export function planPrompt(ctx: WriterContext): PromptPair {
  const user = `TASK: plan
Write the plan for a one-sheet paper zine for this walk.

${contextBlock(ctx)}

RULES:
- title: ≤ ${LIMITS.title} chars, evocative, specific to a real street or feature name from the list.
- subtitle: ≤ ${LIMITS.subtitle} chars.
- ispy: 8 to 10 items. At least 6 must be grounded: featureId = an id from the lists above (waypoints or nearby). Up to 4 may be ambient (featureId null): seasonal or sensory things that are almost surely there.
  label ≤ ${LIMITS.ispyLabel} chars, hint ≤ ${LIMITS.ispyHint} chars, points 5/10/15/20/25 (rarer = more points).
- riddle: 4-6 short lines (use \\n between lines), rhyming if you can, ≤ ${LIMITS.riddleText} chars. Its answer must be a feature at one of the WAYPOINTS: targetFeatureId = that waypoint's id. acceptable = other words someone might write for it.
- sketchPrompt: ≤ ${LIMITS.sketchPrompt} chars, one fun drawing prompt for something on this route.
- listenStop: a waypoint number (1-${ctx.route.waypoints.length}) that is calm enough to stand still for 60 seconds.`;
  return { task: "plan", system: WRITER_SYSTEM, user, temperature: 0.2 };
}

export function ispyPrompt(ctx: WriterContext, plan: TrailPlan): PromptPair {
  return {
    task: "ispy",
    system: WRITER_SYSTEM,
    temperature: 0.8,
    user: `TASK: ispy
Write a fresh I-Spy list for the zine "${plan.title}".

${contextBlock(ctx)}

RULES: 8 to 10 items, at least 6 grounded with a featureId from the lists, up to 4 ambient (featureId null). label ≤ ${LIMITS.ispyLabel} chars, hint ≤ ${LIMITS.ispyHint} chars, points 5/10/15/20/25. Avoid repeating these: ${plan.ispy.map((i) => i.label).join("; ")}.`,
  };
}

export function riddlePrompt(ctx: WriterContext, plan: TrailPlan): PromptPair {
  return {
    task: "riddle",
    system: WRITER_SYSTEM,
    temperature: 0.8,
    user: `TASK: riddle
Write a new riddle for the zine "${plan.title}".

${contextBlock(ctx, 20)}

RULES: 4-6 short lines separated by \\n, rhyming if you can, ≤ ${LIMITS.riddleText} chars. The answer is a feature at one of the WAYPOINTS (targetFeatureId = its id). acceptable = other words people might write. Not the same answer as before ("${plan.riddle.answer}") if another waypoint works.`,
  };
}

export function sketchPrompt(ctx: WriterContext, plan: TrailPlan): PromptPair {
  return {
    task: "sketch",
    system: WRITER_SYSTEM,
    temperature: 0.9,
    user: `TASK: sketch
Write one drawing prompt (≤ ${LIMITS.sketchPrompt} chars) for the zine "${plan.title}" (companions: ${ctx.companions}). Make it about something on this route. Different from: "${plan.sketchPrompt}".

${contextBlock(ctx, 20)}`,
  };
}

/* ------------------------------ stage 2: copy ------------------------------ */

function planSummary(plan: TrailPlan): string {
  return `ZINE: "${plan.title}" — ${plan.subtitle} (vibe: ${plan.vibe}). Listen stop: W${plan.listenStop}.`;
}

export function coverPrompt(ctx: WriterContext, plan: TrailPlan): PromptPair {
  return {
    task: "cover",
    system: WRITER_SYSTEM,
    temperature: 0.8,
    user: `TASK: cover
Write the cover copy.
${planSummary(plan)}
${contextBlock(ctx, 15)}

RULES: kicker ≤ ${LIMITS.coverKicker} chars (a tiny line above the title${ctx.walkerName ? `, address ${ctx.walkerName}` : ""}). blurb ≤ ${LIMITS.coverBlurb} chars: one or two sentences inviting them out, mentioning the weather.`,
  };
}

export function routePrompt(ctx: WriterContext, plan: TrailPlan): PromptPair {
  return {
    task: "route",
    system: WRITER_SYSTEM,
    temperature: 0.7,
    user: `TASK: route
Write landmark-based walking directions, one per waypoint, in order.
${planSummary(plan)}
${contextBlock(ctx, 30)}

RULES:
- stops: exactly ${ctx.route.waypoints.length} items, stop = 1..${ctx.route.waypoints.length}, text ≤ ${LIMITS.routeStop} chars. Use landmarks and directions ("Walk toward the big oak…"), not street numbers. Only mention places from the lists. The last stop ends with heading home to the start.
- ifLost: featureId = a big, easy-to-find feature near the start (from the lists); text ≤ ${LIMITS.ifLost} chars, like "If you get lost: head toward ___ and you're home."`,
  };
}

export function listenPrompt(ctx: WriterContext, plan: TrailPlan): PromptPair {
  return {
    task: "listen",
    system: WRITER_SYSTEM,
    temperature: 0.8,
    user: `TASK: listen
Write the intro for the "Listen" page.
${planSummary(plan)}
${contextBlock(ctx, 10)}

RULES: intro ≤ ${LIMITS.listenIntro} chars. Tell them to stand still at stop ${plan.listenStop} and close their eyes for 60 seconds, and what kind of sounds this spot might have.`,
  };
}

export function backPrompt(ctx: WriterContext, plan: TrailPlan): PromptPair {
  return {
    task: "back",
    system: WRITER_SYSTEM,
    temperature: 0.8,
    user: `TASK: back
Write the back-cover blurb ("Bring me home").
${planSummary(plan)}
WALK: ${ctx.durationMin} min, ${ctx.companions}, ${ctx.location.label}.

RULES: blurb ≤ ${LIMITS.backBlurb} chars. Warm, one or two sentences, about coming back with a scribbled sheet and the phone that waited at home.`,
  };
}
