import type { z } from "zod";
import type { Expected, FieldReport } from "@/lib/schemas";
import { chatJSON } from "@/lib/llm/json";
import type { Chat, ContentPart } from "@/lib/llm/types";
import * as RP from "@/lib/prompts/reader";
import {
  ExtractIspySchema,
  LetterSchema,
  ReadIspySchema,
  ReadListenSchema,
  ReadRiddleSchema,
  ReadSketchSchema,
  WholeSheetSchema,
} from "./schemas";
import { combineTicks, judgeRiddle } from "./combine";

export type ReadMode = "per-panel" | "per-panel+omr" | "whole-sheet";

export interface ReadInput {
  chat: Chat;
  model: string;
  /** data:image/png;base64,… per page; pages 4–7. */
  panels: Partial<Record<4 | 5 | 6 | 7, string>>;
  wholeSheet?: string;
  expected: Expected | null;
  /** Ink fraction per checkbox from OMR. */
  omr: number[] | null;
  mode: ReadMode;
  onStep?: (step: ReadStep) => void;
}

export type ReadStep =
  | { page: 4; ispy: FieldReport["ispy"]; labels: string[] }
  | { page: 5; listen: FieldReport["listen"] }
  | { page: 6; riddle: FieldReport["riddle"] }
  | { page: 7; sketch: FieldReport["sketch"] }
  | { page: 0; letter: string };

export interface ReadResult {
  report: FieldReport;
  labels: string[];
  timings: Record<string, number>;
  paths: Record<string, "llm" | "llm-retry" | "failed">;
}

const img = (url: string): ContentPart => ({ type: "image_url", image_url: { url } });

async function vision<T>(
  chat: Chat,
  model: string,
  name: string,
  prompt: string,
  image: string,
  schema: z.ZodType<T>,
  timings: Record<string, number>,
  paths: ReadResult["paths"],
): Promise<T | null> {
  const t0 = Date.now();
  try {
    const r = await chatJSON({
      chat,
      model,
      name,
      system: RP.READER_SYSTEM,
      user: [{ type: "text", text: prompt }, img(image)],
      schema,
      temperature: 0.1,
      maxTokens: 700,
      retries: 1,
    });
    paths[name] = r.path;
    return r.value;
  } catch {
    paths[name] = "failed";
    return null;
  } finally {
    timings[name] = Date.now() - t0;
  }
}

/** Read the four interactive pages with focused per-panel prompts (or one whole-sheet call, for evals). */
export async function readSheet(input: ReadInput): Promise<ReadResult> {
  const { chat, model, panels, mode } = input;
  const timings: Record<string, number> = {};
  const paths: ReadResult["paths"] = {};
  let expected = input.expected;
  let labels = expected?.ispy.map((i) => i.label) ?? [];

  // A trail from another device: read the printed labels first (graceful degrade).
  if ((!expected || expected.ispy.length === 0) && panels[4]) {
    const ex = await vision(
      chat,
      model,
      "extract-ispy",
      RP.extractIspyPrompt(),
      panels[4],
      ExtractIspySchema,
      timings,
      paths,
    );
    labels = ex?.labels ?? [];
    expected = {
      ispy: labels.map((label) => ({ label, points: 10 })),
      riddle: expected?.riddle ?? { text: "(unknown riddle)", answer: "", acceptable: [] },
      sketchPrompt: expected?.sketchPrompt ?? "the sketch prompt",
      listenStop: expected?.listenStop ?? 4,
    };
  }
  const exp: Expected = expected ?? {
    ispy: [],
    riddle: { text: "", answer: "", acceptable: [] },
    sketchPrompt: "",
    listenStop: 4,
  };
  const n = exp.ispy.length || input.omr?.length || 0;
  const useOmr = mode === "per-panel+omr";

  let ispyG: { index: number; ticked: boolean; confidence: number }[] | null = null;
  let listen: FieldReport["listen"] = { loudest: null, quietest: null, newSound: null };
  let riddleRead: {
    written: string | null;
    verdict: FieldReport["riddle"]["verdict"];
    note: string;
  } | null = null;
  let sketch: FieldReport["sketch"] = {
    description: "We couldn't make out the sketch this time — but we believe you.",
    isBlank: false,
  };

  if (mode === "whole-sheet" && input.wholeSheet) {
    const w = await vision(
      chat,
      model,
      "read-sheet",
      RP.wholeSheetPrompt(exp),
      input.wholeSheet,
      WholeSheetSchema,
      timings,
      paths,
    );
    if (w) {
      ispyG = w.ispy;
      listen = { loudest: w.loudest, quietest: w.quietest, newSound: w.newSound };
      riddleRead = {
        written: w.riddleWritten,
        verdict: w.riddleWritten ? "incorrect" : "blank",
        note: "",
      };
      sketch = { description: w.sketchDescription, isBlank: w.sketchBlank };
    }
  } else {
    if (panels[4])
      ispyG =
        (
          await vision(
            chat,
            model,
            "read-ispy",
            RP.readIspyPrompt(exp),
            panels[4],
            ReadIspySchema,
            timings,
            paths,
          )
        )?.items ?? null;
    const ispy = combineTicks(n, ispyG, useOmr ? input.omr : null);
    input.onStep?.({ page: 4, ispy, labels });
    if (panels[5])
      listen =
        (await vision(
          chat,
          model,
          "read-listen",
          RP.readListenPrompt(exp),
          panels[5],
          ReadListenSchema,
          timings,
          paths,
        )) ?? listen;
    input.onStep?.({ page: 5, listen });
    if (panels[6])
      riddleRead = await vision(
        chat,
        model,
        "read-riddle",
        RP.readRiddlePrompt(exp),
        panels[6],
        ReadRiddleSchema,
        timings,
        paths,
      );
  }

  const written = riddleRead?.written?.trim() || null;
  const det = judgeRiddle(written, exp.riddle.answer, exp.riddle.acceptable);
  // Deterministic match wins when it is sure; otherwise trust Gemma's (lenient) judgement.
  const verdict =
    det === "correct" || det === "blank"
      ? det
      : det === "close" && riddleRead?.verdict !== "correct"
        ? "close"
        : (riddleRead?.verdict ?? "blank");
  const riddle: FieldReport["riddle"] = {
    written,
    verdict: written ? (verdict === "blank" ? "incorrect" : verdict) : "blank",
    note:
      riddleRead?.note ||
      (written
        ? verdict === "correct"
          ? "That's it!"
          : `We were thinking of “${exp.riddle.answer}”.`
        : "No answer this time. The riddle will wait."),
  };
  if (mode !== "whole-sheet") {
    input.onStep?.({ page: 6, riddle });
    if (panels[7])
      sketch =
        (await vision(
          chat,
          model,
          "read-sketch",
          RP.readSketchPrompt(exp),
          panels[7],
          ReadSketchSchema,
          timings,
          paths,
        )) ?? sketch;
    input.onStep?.({ page: 7, sketch });
  }

  const ispy = combineTicks(n, ispyG, useOmr ? input.omr : null);
  const spotted = ispy
    .filter((i) => i.spotted)
    .map((i) => labels[i.index] ?? `item ${i.index + 1}`);
  const t0 = Date.now();
  let letter = "";
  try {
    const r = await chatJSON({
      chat,
      model,
      name: "letter",
      system: RP.READER_SYSTEM,
      user: RP.letterPrompt(exp, {
        spotted,
        listen: [listen.loudest, listen.quietest, listen.newSound].filter((x): x is string => !!x),
        riddle: written ? `wrote "${written}" (${riddle.verdict})` : "left blank",
        sketch: sketch.isBlank ? "left the frame empty" : sketch.description,
      }),
      schema: LetterSchema,
      temperature: 0.8,
      maxTokens: 400,
      retries: 1,
    });
    letter = r.value.letter;
    paths.letter = r.path;
  } catch {
    paths.letter = "failed";
    letter = `Dear walker, your sheet arrived a little crumpled, which is exactly right. You spotted ${spotted.length} of ${ispy.length} things${listen.loudest ? ` and heard "${listen.loudest}"` : ""}. Thank you for leaving the phone at home. — The Trail Office`;
  }
  timings.letter = Date.now() - t0;
  input.onStep?.({ page: 0, letter });
  return { report: { ispy, listen, riddle, sketch, letter }, labels, timings, paths };
}
