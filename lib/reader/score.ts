import type { FieldReport } from "@/lib/schemas";

export interface ScoreBreakdown {
  ispy: number;
  riddle: number;
  sketch: number;
  listen: number;
  total: number;
  spotted: number;
  of: number;
}

/** Points for spotted items + 20 correct riddle (10 close) + 10 sketch + 10 any listen line. */
export function score(report: FieldReport, points: number[]): ScoreBreakdown {
  const ispy = report.ispy.reduce((s, it) => s + (it.spotted ? (points[it.index] ?? 0) : 0), 0);
  const riddle =
    report.riddle.verdict === "correct" ? 20 : report.riddle.verdict === "close" ? 10 : 0;
  const sketch = report.sketch.isBlank ? 0 : 10;
  const l = report.listen;
  const listen = [l.loudest, l.quietest, l.newSound].some((x) => x && x.trim()) ? 10 : 0;
  return {
    ispy,
    riddle,
    sketch,
    listen,
    total: ispy + riddle + sketch + listen,
    spotted: report.ispy.filter((i) => i.spotted).length,
    of: report.ispy.length,
  };
}
