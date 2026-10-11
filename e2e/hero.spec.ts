import { expect, test } from "@playwright/test";

/*
 * The hero fold on awkward screens, drawn by the Canvas 2D renderer (what
 * Data Saver, 2G and no-WebGL devices get). It must render the fold, not the
 * still fallback, and never paint a solid dark slab (the old off-canvas
 * shadow trick leaked one onto the page when the paper sat far from centre).
 */
const SCREENS = [
  { name: "portrait tablet", width: 1080, height: 1753 },
  { name: "iPad portrait", width: 820, height: 1180 },
  { name: "phone", width: 390, height: 844 },
  { name: "phone on its side", width: 844, height: 360 },
  { name: "laptop", width: 1280, height: 800 },
];

for (const s of SCREENS) {
  test(`hero fold draws cleanly in 2D on a ${s.name} (${s.width}×${s.height})`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height } });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "connection", { get: () => ({ saveData: true }) }),
    );
    await page.goto("/");
    const canvas = page.locator("#unfold canvas");
    await expect(canvas).toHaveCount(1);
    const total = await page.evaluate(
      () => document.getElementById("unfold")!.offsetHeight - innerHeight,
    );
    for (const p of [0, 0.25, 0.55, 1]) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(total * p));
      await page.waitForTimeout(900);
      const dark = await canvas.evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4)
          if (d[i + 3]! > 200 && d[i]! + d[i + 1]! + d[i + 2]! < 120) n++;
        return n / (d.length / 4);
      });
      // Ink on the printed sheet is a few percent at most.
      expect(dark, `dark pixels at ${p * 100}% of the story`).toBeLessThan(0.03);
    }
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
