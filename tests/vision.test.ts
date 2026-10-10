import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applyH, solveHomography } from "@/lib/vision/homography";
import { warpToSheet } from "@/lib/vision/warp";
import { createRGBA, rotate180, toGray } from "@/lib/vision/image";
import { detectFiducials } from "@/lib/vision/fiducials";
import { detect, measureTicks, processPhoto } from "@/lib/vision/sheet";
import { ispyRows, sheetGeometry } from "@/lib/zine/layout";
import { omrVote } from "@/lib/reader/combine";
import { loadJpeg } from "./helpers";

function fillRect(
  img: ReturnType<typeof createRGBA>,
  x: number,
  y: number,
  w: number,
  h: number,
  v: number,
) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
      if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) continue;
      const o = (yy * img.width + xx) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
    }
}

describe("homography", () => {
  it("maps the four source points onto the destination points", () => {
    const src = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ];
    const dst = [
      { x: 12, y: 30 },
      { x: 410, y: 8 },
      { x: 440, y: 350 },
      { x: 4, y: 300 },
    ];
    const H = solveHomography(src, dst);
    src.forEach((p, i) => {
      const q = applyH(H, p);
      expect(q.x).toBeCloseTo(dst[i]!.x, 6);
      expect(q.y).toBeCloseTo(dst[i]!.y, 6);
    });
  });

  it("throws on degenerate points", () => {
    const p = { x: 1, y: 1 };
    expect(() => solveHomography([p, p, p, p], [p, p, p, p])).toThrow();
  });
});

describe("synthetic warp + fiducials", () => {
  // A flat "sheet" raster with fiducials and one dark square, then a perspective-warped "photo" of it.
  const g = sheetGeometry("letter");
  const ppm = 3;
  const flat = createRGBA(Math.round(g.w * ppm), Math.round(g.h * ppm), 250);
  for (const f of g.fiducials) {
    fillRect(flat, f.x * ppm, f.y * ppm, f.size * ppm, f.size * ppm, 0);
    fillRect(flat, (f.cx - 2) * ppm, (f.cy - 2) * ppm, 4 * ppm, 4 * ppm, 250);
  }
  fillRect(flat, 100 * ppm, 100 * ppm, 20 * ppm, 20 * ppm, 20);
  const corners = [
    { x: 60, y: 90 },
    { x: 980, y: 40 },
    { x: 1010, y: 760 },
    { x: 30, y: 700 },
  ];
  const sheetCorners = [
    { x: 0, y: 0 },
    { x: g.w, y: 0 },
    { x: g.w, y: g.h },
    { x: 0, y: g.h },
  ];
  // Build the photo by warping the flat sheet: photo px → sheet mm is the inverse of sheet→photo.
  const photo = (() => {
    const out = createRGBA(1060, 820, 90);
    const H = solveHomography(corners, sheetCorners);
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++) {
        const p = applyH(H, { x, y });
        const sx = Math.round(p.x * ppm);
        const sy = Math.round(p.y * ppm);
        if (sx < 0 || sy < 0 || sx >= flat.width || sy >= flat.height) continue;
        const i = (sy * flat.width + sx) * 4;
        const o = (y * out.width + x) * 4;
        out.data[o] = out.data[o + 1] = out.data[o + 2] = flat.data[i]!;
      }
    return out;
  })();

  it("finds all four corner markers", () => {
    const d = detectFiducials(toGray(photo));
    expect(d.corners).not.toBeNull();
    expect(d.confidence).toBeGreaterThan(0.5);
    const H = solveHomography(sheetCorners, corners);
    g.fiducials.forEach((f, i) => {
      const exp = applyH(H, { x: f.cx, y: f.cy });
      expect(Math.hypot(d.corners![i]!.x - exp.x, d.corners![i]!.y - exp.y)).toBeLessThan(4);
    });
  });

  it("warps the photo back flat (dark square lands where it was printed)", () => {
    const d = detectFiducials(toGray(photo));
    const sheetPts = g.fiducials.map((f) => ({ x: f.cx, y: f.cy }));
    const flatAgain = warpToSheet(photo, sheetPts, d.corners!, g.w, g.h, 2);
    const at = (xmm: number, ymm: number) =>
      flatAgain.data[(Math.round(ymm * 2) * flatAgain.width + Math.round(xmm * 2)) * 4]!;
    expect(at(110, 110)).toBeLessThan(80); // inside the dark square
    expect(at(150, 150)).toBeGreaterThan(200); // blank paper
  });
});

describe("rotate180", () => {
  it("reverses pixel order", () => {
    const img = createRGBA(2, 1);
    img.data.set([1, 1, 1, 255, 9, 9, 9, 255]);
    expect(Array.from(rotate180(img).data)).toEqual([9, 9, 9, 255, 1, 1, 1, 255]);
  });
});

describe("OMR on synthetic boxes", () => {
  it("measures ink inside known checkbox rects", () => {
    const g = sheetGeometry("a4");
    const ppm = 6;
    const panel = createRGBA(Math.round(g.panelW * ppm), Math.round(g.panelH * ppm), 245);
    const rows = ispyRows(g, 9);
    rows.forEach((r) => {
      // printed outline
      fillRect(panel, r.box.x * ppm, r.box.y * ppm, r.box.w * ppm, 0.6 * ppm, 20);
      fillRect(panel, r.box.x * ppm, (r.box.y + r.box.h - 0.6) * ppm, r.box.w * ppm, 0.6 * ppm, 20);
    });
    // tick rows 0 and 3
    for (const i of [0, 3])
      fillRect(
        panel,
        (rows[i]!.box.x + 2) * ppm,
        (rows[i]!.box.y + 2) * ppm,
        2.5 * ppm,
        2.5 * ppm,
        40,
      );
    const ink = measureTicks(panel, "a4", 9, ppm);
    expect(omrVote(ink[0]!)).toBe("ticked");
    expect(omrVote(ink[3]!)).toBe("ticked");
    expect(omrVote(ink[1]!)).toBe("empty");
    expect(omrVote(ink[8]!)).toBe("empty");
  });
});

describe("synthetic phone photos (fixtures/photos)", () => {
  const files = JSON.parse(readFileSync("fixtures/photos/index.json", "utf8")) as string[];
  it.each(files.slice(0, 4))("%s: detects corners and reads ticks by OMR", (file) => {
    const truth = JSON.parse(
      readFileSync(`fixtures/photos/${file.replace(".jpg", ".json")}`, "utf8"),
    ) as { paper: "letter" | "a4"; ticked: boolean[] };
    const img = loadJpeg(`fixtures/photos/${file}`);
    const d = detect(img);
    expect(d.corners, "fiducials").not.toBeNull();
    expect(d.confidence).toBeGreaterThanOrEqual(0.5);
    const proc = processPhoto(img, truth.paper, d.corners!, truth.ticked.length);
    const votes = proc.omr.map(omrVote);
    const correct = votes.filter((v, i) => (v === "ticked") === truth.ticked[i]).length;
    expect(correct / truth.ticked.length).toBeGreaterThanOrEqual(0.85);
    expect(proc.panels[4].width).toBeGreaterThan(300);
  });
});
