import { describe, expect, it } from "vitest";
import {
  combineTicks,
  judgeRiddle,
  levenshtein,
  normalizeAnswer,
  omrVote,
} from "@/lib/reader/combine";
import { score } from "@/lib/reader/score";
import { readSheet } from "@/lib/reader/read";
import { mockChat } from "@/lib/llm/mock";
import { FieldReportSchema, type FieldReport } from "@/lib/schemas";

describe("combining Gemma with OMR", () => {
  it("agreement → high confidence 'both'", () => {
    const r = combineTicks(
      2,
      [
        { index: 0, ticked: true, confidence: 0.7 },
        { index: 1, ticked: false, confidence: 0.8 },
      ],
      [0.3, 0.0],
    );
    expect(r[0]).toMatchObject({ spotted: true, source: "both" });
    expect(r[0]!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r[1]).toMatchObject({ spotted: false, source: "both" });
  });
  it("disagreement → unsure, ask the user", () => {
    const r = combineTicks(1, [{ index: 0, ticked: false, confidence: 0.9 }], [0.4]);
    expect(r[0]!.unsure).toBe(true);
    expect(r[0]!.confidence).toBeLessThan(0.6);
  });
  it("works with only one signal", () => {
    expect(combineTicks(1, null, [0.5])[0]).toMatchObject({ spotted: true, source: "omr" });
    expect(combineTicks(1, [{ index: 0, ticked: true, confidence: 0.9 }], null)[0]).toMatchObject({
      spotted: true,
      source: "gemma",
    });
    expect(omrVote(0.05)).toBe("unsure");
  });
});

describe("riddle judging is lenient", () => {
  it.each([
    ["The Fountain", "fountain", [], "correct"],
    ["fontain", "fountain", [], "correct"],
    ["drinking fountain", "drinking fountain", [], "correct"],
    ["drnkin fontan", "drinking fountain", [], "close"],
    ["mailbox", "post box", ["mailbox"], "correct"],
    ["", "bench", [], "blank"],
  ] as const)("%s vs %s", (w, a, acc, v) => {
    expect(judgeRiddle(w || null, a, [...acc])).toBe(v);
  });
  it("leaves real disagreements to Gemma", () => {
    expect(judgeRiddle("lamp post", "fountain", [])).toBeNull();
  });
  it("normalises and measures", () => {
    expect(normalizeAnswer("  The Café! ")).toBe("cafe");
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});

describe("score", () => {
  const base: FieldReport = {
    ispy: [
      { index: 0, spotted: true, confidence: 1, source: "both" },
      { index: 1, spotted: false, confidence: 1, source: "both" },
      { index: 2, spotted: true, confidence: 1, source: "user" },
    ],
    listen: { loudest: "a bus", quietest: null, newSound: null },
    riddle: { written: "fountain", verdict: "correct", note: "" },
    sketch: { description: "a tree", isBlank: false },
    letter: "",
  };
  it("adds spotted points + riddle + sketch + listen", () => {
    expect(score(base, [10, 20, 15]).total).toBe(10 + 15 + 20 + 10 + 10);
  });
  it("close riddle is 10, blank sketch and listen are 0", () => {
    const s = score(
      {
        ...base,
        riddle: { ...base.riddle, verdict: "close" },
        sketch: { description: "", isBlank: true },
        listen: { loudest: null, quietest: " ", newSound: null },
      },
      [10, 20, 15],
    );
    expect(s.total).toBe(25 + 10);
  });
});

describe("readSheet with a mock vision model", () => {
  const img = "data:image/png;base64,iVBORw0KGgo=";
  const expected = {
    ispy: [
      { label: "A bench", points: 10 },
      { label: "A tree", points: 5 },
      { label: "A post box", points: 20 },
    ],
    riddle: { text: "r", answer: "fountain", acceptable: [] },
    sketchPrompt: "Draw a tree",
    listenStop: 2,
  };
  it("reads each panel, combines with OMR and writes a letter", async () => {
    const steps: number[] = [];
    const r = await readSheet({
      chat: mockChat(),
      model: "gemma4:e4b",
      panels: { 4: img, 5: img, 6: img, 7: img },
      expected,
      omr: [0.3, 0.0, 0.0],
      mode: "per-panel+omr",
      onStep: (s) => steps.push(s.page),
    });
    expect(FieldReportSchema.safeParse(r.report).success).toBe(true);
    expect(steps).toEqual([4, 5, 6, 7, 0]);
    expect(r.report.ispy[0]!.source).toBe("both");
    // Mock Gemma ticks rows 0 and 1; OMR sees ink only in row 0 → row 1 is a disagreement.
    expect(r.report.ispy[1]!.unsure).toBe(true);
    expect(r.report.ispy[2]).toMatchObject({ spotted: false, source: "both" });
    expect(r.report.riddle.verdict).toBe("correct");
    expect(r.report.letter).toContain("Trail Office");
  });
  it("degrades gracefully: unknown trail extracts labels first", async () => {
    const r = await readSheet({
      chat: mockChat(),
      model: "m",
      panels: { 4: img },
      expected: null,
      omr: null,
      mode: "per-panel",
    });
    expect(r.labels.length).toBeGreaterThan(0);
    expect(r.report.ispy.length).toBe(r.labels.length);
  });
  it("survives a dead endpoint with OMR and a template letter", async () => {
    const r = await readSheet({
      chat: mockChat({ fail: true }),
      model: "m",
      panels: { 4: img, 5: img, 6: img, 7: img },
      expected,
      omr: [0.3, 0.0, 0.25],
      mode: "per-panel+omr",
    });
    expect(r.report.ispy.map((i) => i.spotted)).toEqual([true, false, true]);
    expect(r.report.letter).toContain("Trail Office");
    expect(r.paths["read-ispy"]).toBe("failed");
  });
});
