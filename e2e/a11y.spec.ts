import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { makeTrail } from "./helpers";

async function serious(page: Page) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(" "))
          .join(" | ")}`,
    );
}

test("landing has no serious accessibility violations", async ({ page }) => {
  await page.goto("/");
  expect(await serious(page)).toEqual([]);
});

test("setup, preview and report have no serious accessibility violations", async ({ page }) => {
  await page.goto("/new");
  expect(await serious(page)).toEqual([]);
  const id = await makeTrail(page, "cubbon-park");
  expect(await serious(page)).toEqual([]);
  await page.goto(`/return/${id}`);
  await page.getByTestId("photo-input").setInputFiles("fixtures/photos/sheet-02.jpg");
  await page.getByTestId("read").click();
  await expect(page.getByTestId("field-report")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1200); // let the stamp land
  expect(await serious(page)).toEqual([]);
  await page.goto("/book");
  expect(await serious(page)).toEqual([]);
});
