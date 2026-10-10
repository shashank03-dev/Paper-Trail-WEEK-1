import { describe, expect, it } from "vitest";
import { SHEET_H, SHEET_W, foldVertices } from "@/components/landing/foldSheet";

/** A grid over the sheet, tagged with the panel (col, row) each vertex sits inside. */
function grid(nx = 81, ny = 41) {
  const flat = new Float32Array(nx * ny * 2);
  const tag: { col: number; row: number; inner: boolean }[] = [];
  let i = 0;
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const fx = -SHEET_W / 2 + (SHEET_W * x) / (nx - 1);
      const fy = SHEET_H / 2 - (SHEET_H * y) / (ny - 1);
      flat[i++] = fx;
      flat[i++] = fy;
      const u = (fx + SHEET_W / 2) / (SHEET_W / 4);
      const v = (SHEET_H / 2 - fy) / (SHEET_H / 2);
      const col = Math.min(3, Math.floor(u));
      const row = Math.min(1, Math.floor(v));
      // Keep away from creases, where layers legitimately meet in the bend.
      const inner = u - col > 0.12 && u - col < 0.88 && v - row > 0.12 && v - row < 0.88;
      tag.push({ col, row, inner });
    }
  return { flat, tag };
}

describe("the folding sheet", () => {
  it("is the flat sheet (plus a gentle curl) when nothing is folded", () => {
    const { flat } = grid();
    const out = new Float32Array((flat.length / 2) * 3);
    foldVertices(flat, out, { top: 0, a: 0, b: 0, c: 0, flex: 0 });
    for (let v = 0; v < flat.length / 2; v++) {
      expect(out[v * 3]).toBeCloseTo(flat[v * 2]!, 6);
      expect(out[v * 3 + 1]).toBeCloseTo(flat[v * 2 + 1]!, 6);
      expect(Math.abs(out[v * 3 + 2]!)).toBeLessThan(0.03);
    }
  });

  it("folds into a booklet with page 1 on top and every layer under it", () => {
    const { flat, tag } = grid();
    const out = new Float32Array((flat.length / 2) * 3);
    foldVertices(flat, out, { top: 1, a: 1, b: 1, c: 1, flex: 0 });
    // Page 1 is the bottom-right panel (col 3, row 1); it must be the front-most layer.
    const layers = new Map<string, number[]>();
    for (let v = 0; v < tag.length; v++) {
      const t = tag[v]!;
      if (!t.inner) continue;
      const x = out[v * 3]!;
      const y = out[v * 3 + 1]!;
      // Everything ends up inside page 1's footprint.
      expect(x).toBeGreaterThan(SHEET_W / 4 - 0.12);
      expect(x).toBeLessThan(SHEET_W / 2 + 0.12);
      expect(y).toBeGreaterThan(-SHEET_H / 2 - 0.12);
      expect(y).toBeLessThan(0.12);
      const k = `${t.col},${t.row}`;
      layers.set(k, [...(layers.get(k) ?? []), out[v * 3 + 2]!]);
    }
    const mean = (a: number[]) => a.reduce((s, z) => s + z, 0) / a.length;
    const z = [...layers.entries()].map(([k, zs]) => ({ k, z: mean(zs) }));
    z.sort((p, q) => q.z - p.z);
    expect(z[0]!.k).toBe("3,1");
    // Eight distinct layers, none sharing a plane (no z-fighting).
    for (let i = 1; i < z.length; i++) expect(z[i - 1]!.z - z[i]!.z).toBeGreaterThan(0.004);
    expect(z).toHaveLength(8);
  });
});
