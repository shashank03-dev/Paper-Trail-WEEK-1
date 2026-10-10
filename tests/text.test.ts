import { describe, expect, it } from "vitest";
import { ellipsize, fitText, measure, wrap } from "@/lib/zine/text";
import { fitsEverywhere } from "@/lib/zine/boxes";

describe("text metrics", () => {
  it("measures wider text as wider and scales with size", () => {
    expect(measure("MMMM", "ui-400", 3)).toBeGreaterThan(measure("iiii", "ui-400", 3));
    expect(measure("hello", "display-700", 6)).toBeCloseTo(measure("hello", "display-700", 3) * 2);
  });
  it("wraps within the width", () => {
    const lines = wrap(
      "The quick brown fox jumps over the lazy dog near the fountain",
      "ui-400",
      2.5,
      30,
    );
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(measure(l, "ui-400", 2.5)).toBeLessThanOrEqual(30 + 1e-6);
  });
  it("breaks a single overlong word", () => {
    const lines = wrap("Supercalifragilisticexpialidocious", "display-700", 8, 20);
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("fitText", () => {
  const box = {
    font: "display-700" as const,
    maxSize: 8,
    minSize: 4,
    maxW: 50,
    maxH: 20,
    lineHeight: 1.1,
  };
  it("keeps the max size when short text fits", () => {
    const r = fitText("Alder Street", box);
    expect(r.size).toBe(8);
    expect(r.truncated).toBe(false);
  });
  it("shrinks toward the min size before giving up", () => {
    const r = fitText("The Secret Life of the Very Long Avenue Near the Station", box);
    expect(r.size).toBeLessThan(8);
    expect(r.size).toBeGreaterThanOrEqual(4);
    expect(r.height).toBeLessThanOrEqual(20 + 1e-6);
  });
  it("truncates with an ellipsis if it still overflows at the min size", () => {
    const r = fitText("word ".repeat(200), box);
    expect(r.truncated).toBe(true);
    expect(r.lines[r.lines.length - 1]!.endsWith("…")).toBe(true);
    expect(r.height).toBeLessThanOrEqual(20 + 1e-6);
  });
  it("ellipsize fits a single line", () => {
    const t = ellipsize("A very long label that does not fit", "ui-600", 2.5, 20);
    expect(measure(t, "ui-600", 2.5)).toBeLessThanOrEqual(20);
    expect(t.endsWith("…")).toBe(true);
  });
  it("panel boxes accept reasonable copy and reject essays", () => {
    expect(fitsEverywhere("coverTitle", "The Secret Life of Alder Street")).toBe(true);
    expect(
      fitsEverywhere("listenIntro", "Stand still at stop 4. Close your eyes for 60 seconds."),
    ).toBe(true);
    expect(fitsEverywhere("listenIntro", "Listen ".repeat(80))).toBe(false);
  });
});
