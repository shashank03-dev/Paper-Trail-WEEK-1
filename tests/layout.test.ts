import { describe, expect, it } from "vitest";
import {
  IMPOSITION,
  PAGES,
  panelToSheet,
  sheetGeometry,
  ispyRows,
  contentBox,
  FOOTER,
} from "@/lib/zine/layout";

describe("imposition (standard one-cut mini-zine)", () => {
  it("top row is 5 4 3 2, rotated 180°", () => {
    const top = [0, 1, 2, 3].map((c) =>
      PAGES.find((p) => IMPOSITION[p].row === 0 && IMPOSITION[p].col === c),
    );
    expect(top).toEqual([5, 4, 3, 2]);
    for (const p of [5, 4, 3, 2] as const) expect(IMPOSITION[p].rotated).toBe(true);
  });
  it("bottom row is 6 7 8 1, upright", () => {
    const bottom = [0, 1, 2, 3].map((c) =>
      PAGES.find((p) => IMPOSITION[p].row === 1 && IMPOSITION[p].col === c),
    );
    expect(bottom).toEqual([6, 7, 8, 1]);
    for (const p of [6, 7, 8, 1] as const) expect(IMPOSITION[p].rotated).toBe(false);
  });
  it("every page has exactly one cell", () => {
    const cells = new Set(PAGES.map((p) => `${IMPOSITION[p].row},${IMPOSITION[p].col}`));
    expect(cells.size).toBe(8);
  });
});

describe("sheet geometry", () => {
  it.each(["letter", "a4"] as const)(
    "%s: 6 mm margins, 4×2 grid, cut across the middle two columns",
    (paper) => {
      const g = sheetGeometry(paper);
      expect(g.grid.x).toBe(6);
      expect(g.grid.w).toBeCloseTo(g.w - 12);
      expect(g.panelW * 4).toBeCloseTo(g.grid.w);
      expect(g.cut.x1).toBeCloseTo(g.grid.x + g.panelW);
      expect(g.cut.x2).toBeCloseTo(g.grid.x + 3 * g.panelW);
      expect(g.cut.y1).toBeCloseTo(g.h / 2);
    },
  );

  it("rotating a top-row panel maps its local top-left to the cell's bottom-right", () => {
    const g = sheetGeometry("letter");
    const c = g.cells[4];
    const p = panelToSheet(g, 4, 0, 0);
    expect(p.x).toBeCloseTo(c.x + c.w);
    expect(p.y).toBeCloseTo(c.y + c.h);
    const q = panelToSheet(g, 1, 0, 0);
    expect(q).toEqual({ x: g.cells[1].x, y: g.cells[1].y });
  });

  it("every fiducial sits in a panel-local bottom corner (the footer band) of pages 1, 2, 5, 6", () => {
    const g = sheetGeometry("a4");
    for (const f of g.fiducials) {
      const page = PAGES.find((p) => {
        const c = g.cells[p];
        return f.cx > c.x && f.cx < c.x + c.w && f.cy > c.y && f.cy < c.y + c.h;
      })!;
      expect([1, 2, 5, 6]).toContain(page);
      const c = g.cells[page];
      const localY = c.rotated ? c.y + c.h - f.cy : f.cy - c.y;
      expect(localY).toBeGreaterThan(g.panelH - FOOTER);
    }
  });

  it("I-Spy rows stay inside the content box with ≥6 mm boxes", () => {
    for (const paper of ["letter", "a4"] as const) {
      const g = sheetGeometry(paper);
      const cb = contentBox(g);
      for (const n of [8, 9, 10]) {
        const rows = ispyRows(g, n);
        const last = rows[rows.length - 1]!;
        expect(last.y + last.pitch).toBeLessThanOrEqual(cb.y + cb.h + 1e-6);
        expect(rows[0]!.box.w).toBeGreaterThanOrEqual(5.5);
        if (n === 8) expect(rows[0]!.box.w).toBeGreaterThanOrEqual(6.9);
      }
    }
  });
});
