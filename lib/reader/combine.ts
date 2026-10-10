import type { FieldReport } from "@/lib/schemas";

/** OMR thresholds on ink fraction inside a checkbox (0..1). */
export const OMR_TICKED = 0.09;
export const OMR_EMPTY = 0.03;

export type OmrVote = "ticked" | "empty" | "unsure";
export function omrVote(ink: number): OmrVote {
  return ink >= OMR_TICKED ? "ticked" : ink <= OMR_EMPTY ? "empty" : "unsure";
}

/**
 * Combine Gemma's read with classic OMR. Agree → high confidence ("both").
 * Disagree → mark unsure and ask the user to tap.
 */
export function combineTicks(
  n: number,
  gemma: { index: number; ticked: boolean; confidence: number }[] | null,
  omr: number[] | null,
): FieldReport["ispy"] {
  return Array.from({ length: n }, (_, index) => {
    const g = gemma?.find((x) => x.index === index) ?? null;
    const ink = omr?.[index];
    const vote = ink === undefined ? null : omrVote(ink);
    if (g && vote && vote !== "unsure") {
      const o = vote === "ticked";
      if (o === g.ticked)
        return {
          index,
          spotted: o,
          confidence: Math.max(0.9, g.confidence),
          source: "both",
          gemma: g.ticked,
          omrInk: ink,
        };
      // Disagreement: trust OMR's clear signal a little more, but ask.
      return {
        index,
        spotted: o,
        confidence: 0.45,
        source: "omr",
        unsure: true,
        gemma: g.ticked,
        omrInk: ink,
      };
    }
    if (g)
      return {
        index,
        spotted: g.ticked,
        confidence: Math.min(g.confidence, vote === "unsure" ? 0.6 : 1),
        source: "gemma",
        unsure: vote === "unsure" || g.confidence < 0.6,
        gemma: g.ticked,
        ...(ink !== undefined ? { omrInk: ink } : {}),
      };
    if (vote)
      return {
        index,
        spotted: vote === "ticked",
        confidence: vote === "unsure" ? 0.4 : 0.8,
        source: "omr",
        unsure: vote === "unsure",
        gemma: null,
        omrInk: ink,
      };
    return { index, spotted: false, confidence: 0, source: "omr", unsure: true, gemma: null };
  });
}

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(a|an|the)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    prev = cur;
  }
  return prev[n]!;
}

/** Lenient deterministic check; Gemma's judgement is used when this is unsure. */
export function judgeRiddle(
  written: string | null,
  answer: string,
  acceptable: string[],
): FieldReport["riddle"]["verdict"] | null {
  if (!written || !normalizeAnswer(written)) return "blank";
  const w = normalizeAnswer(written);
  const targets = [answer, ...acceptable].map(normalizeAnswer).filter(Boolean);
  for (const t of targets) {
    if (w === t || w.includes(t) || (t.includes(w) && w.length >= 4)) return "correct";
    const d = levenshtein(w, t);
    if (d <= Math.max(1, Math.floor(t.length / 5))) return "correct";
    if (d <= Math.max(2, Math.floor(t.length / 3))) return "close";
  }
  return null;
}
