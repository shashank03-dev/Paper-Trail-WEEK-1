/**
 * A deterministic stand-in for Gemma, used by unit tests, the e2e suite and
 * `pnpm mock:llm`. It reads the same prompts the real model gets and returns
 * schema-valid JSON grounded in the features listed in the prompt.
 * It is NOT used by the app at runtime unless you point LLM_BASE_URL at it.
 */
import type { ChatRequest } from "./types";

interface ParsedFeature {
  id: string;
  kind: string;
  name?: string;
  waypoint: boolean;
}

function textOf(req: ChatRequest): string {
  return req.messages
    .filter((m) => m.role === "user")
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : m.content.map((p) => (p.type === "text" ? p.text : "")).join("\n"),
    )
    .join("\n");
}

export function parseFeatures(prompt: string): ParsedFeature[] {
  const out: ParsedFeature[] = [];
  const re = /^(W\d+ = )?([nwr]\d[\w-]*) \| ([\w-]+) \| (?:"([^"]*)"|-) \|/gm;
  for (const m of prompt.matchAll(re))
    out.push({ id: m[2]!, kind: m[3]!, ...(m[4] ? { name: m[4] } : {}), waypoint: !!m[1] });
  return out;
}

const words = (f: ParsedFeature) => (f.name ?? `the ${f.kind.replace(/_/g, " ")}`).slice(0, 30);
const POINTS = [10, 15, 20, 5, 25, 10, 15, 20] as const;

export function mockContent(req: ChatRequest): string {
  const prompt = textOf(req);
  const task = prompt.match(/^TASK: ([\w-]+)/m)?.[1] ?? "chat";
  const feats = parseFeatures(prompt);
  const wps = feats.filter((f) => f.waypoint);
  const named = feats.find((f) => f.waypoint && f.name) ?? feats.find((f) => f.name) ?? feats[0];
  const lastAnswer =
    (task.startsWith("read") ? prompt.match(/The intended answer: "([^"]*)"/)?.[1] : null) ?? "";

  const ispy = () => {
    const seen = new Set<string>();
    const grounded = [...wps, ...feats.filter((f) => !f.waypoint)]
      .filter((f) => {
        const k = words(f).toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 7)
      .map((f, i) => ({
        featureId: f.id,
        label: words(f),
        hint: `find it ${f.waypoint ? "on the loop" : "nearby"}`,
        points: POINTS[i % POINTS.length]!,
      }));
    return [
      ...grounded,
      {
        featureId: null,
        label: "A cloud shaped like an animal",
        hint: "which animal?",
        points: 15,
      },
      {
        featureId: null,
        label: "A leaf that's two colours",
        hint: "half green, half not",
        points: 10,
      },
    ];
  };
  const riddle = () => {
    const t = wps[0] ?? feats[0];
    return {
      targetFeatureId: t?.id ?? "n0",
      text: "I wait on your loop, I never roam,\nI'm stop number one on the way from home.\nLook for me first, then write me down.\nWhat am I, in this part of town?",
      answer: (t?.name ?? t?.kind ?? "landmark").replace(/_/g, " ").slice(0, 40),
      acceptable: [(t?.kind ?? "landmark").replace(/_/g, " ")],
    };
  };

  switch (task) {
    case "plan":
      return JSON.stringify({
        title: `Small Wonders of ${named?.name ?? "the Block"}`.slice(0, 48),
        subtitle: "A loop of real things, written for one pencil",
        vibe: /puddle edition/.test(prompt)
          ? "rainy-day"
          : /golden hour/.test(prompt)
            ? "golden-hour"
            : "curious",
        ispy: ispy(),
        riddle: riddle(),
        sketchPrompt: /companions: dog/.test(prompt)
          ? "Draw your dog's favourite smell (somehow)."
          : "Draw the strangest tree on your route.",
        listenStop: Math.min(2, Math.max(1, wps.length)),
      });
    case "ispy":
      return JSON.stringify({ ispy: ispy().reverse() });
    case "riddle":
      return JSON.stringify(riddle());
    case "sketch":
      return JSON.stringify({ sketchPrompt: "Draw the bench as if it could talk." });
    case "cover":
      return JSON.stringify({
        kicker: "A field guide for a short walk",
        blurb:
          "The sheet knows the way. The phone can rest. Take a pencil and go see what's really there.",
      });
    case "route":
      return JSON.stringify({
        stops: wps.map((f, i) => ({
          stop: i + 1,
          text: `Walk toward ${words(f)} and look around for a moment.${i === wps.length - 1 ? " Then head home." : ""}`,
        })),
        ifLost: {
          featureId: (named ?? feats[0])?.id ?? "n0",
          text: `If you get lost: head toward ${named?.name ?? "the start"} and you're home.`.slice(
            0,
            70,
          ),
        },
      });
    case "listen":
      return JSON.stringify({
        intro:
          "Stand still at stop two. Close your eyes for 60 seconds. Listen for wheels, wings and whispers.",
      });
    case "back":
      return JSON.stringify({
        blurb: "You went out with paper and came back with a story. The phone waited. Good phone.",
      });
    case "read-ispy": {
      const rows = [...prompt.matchAll(/^(\d+)\. /gm)].length;
      return JSON.stringify({
        items: Array.from({ length: rows }, (_, i) => ({
          index: i,
          ticked: i % 3 !== 2,
          confidence: 0.82,
        })),
      });
    }
    case "read-listen":
      return JSON.stringify({
        loudest: "a bus sighing at the stop",
        quietest: "leaves on the path",
        newSound: "my own shoes",
      });
    case "read-riddle":
      return JSON.stringify({
        written: lastAnswer || "a bench",
        verdict: "correct",
        note: "Spot on — that's exactly where the riddle was hiding.",
      });
    case "read-sketch":
      return JSON.stringify({
        description:
          "A tree with three branches, like it's waving at you, and a small sun in the corner.",
        isBlank: false,
      });
    case "letter":
      return JSON.stringify({
        letter:
          "Dear walker, your sheet arrived here a little crumpled, which is how we know it went somewhere. We liked the bus sighing at the stop. Your tree is waving back at us. — The Trail Office",
      });
    case "extract-ispy":
      return JSON.stringify({
        labels: [
          "Something round",
          "A bench",
          "A tree",
          "A post box",
          "A cloud",
          "A leaf",
          "A bike",
          "A lamp",
        ],
      });
    case "read-sheet":
      return JSON.stringify({
        ispy: Array.from({ length: 9 }, (_, i) => ({
          index: i,
          ticked: i % 2 === 0,
          confidence: 0.6,
        })),
        loudest: "a bus",
        quietest: null,
        newSound: null,
        riddleWritten: lastAnswer || null,
        sketchDescription: "Some lines in a frame.",
        sketchBlank: false,
      });
    default:
      return "OK";
  }
}

/** For tests: a chat function that returns broken JSON `brokenTimes` times first. */
export function mockChat(
  opts: { brokenTimes?: number; fail?: boolean; groundingBreaker?: boolean } = {},
) {
  let broken = opts.brokenTimes ?? 0;
  let calls = 0;
  const fn = async (req: ChatRequest, o?: { onDelta?: (t: string) => void }) => {
    calls++;
    if (opts.fail) throw new Error("connect ECONNREFUSED 127.0.0.1:11434");
    let content = mockContent(req);
    if (broken > 0) {
      broken--;
      content = opts.groundingBreaker
        ? content.replace(/"featureId":"[nwr]\d+"/g, '"featureId":"n999999999"')
        : `Sure! Here is your JSON: {"title": "oops",`;
    }
    o?.onDelta?.(content);
    return { content, ms: 5, completionTokens: Math.round(content.length / 4) };
  };
  return Object.assign(fn, { calls: () => calls });
}
