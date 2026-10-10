import type { Page } from "@playwright/test";

export const FIXED_NOW = new Date("2026-10-10T10:00:00Z");

/** Landing → setup with a demo preset → generate → the finished preview. Returns the trail id. */
export async function makeTrail(page: Page, preset = "dolores-park"): Promise<string> {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/");
  await page
    .getByRole("link", { name: /make my trail/i })
    .first()
    .click();
  await page.waitForURL("**/new");
  await page.locator(`[data-preset="${preset}"]`).click();
  await page.getByTestId("fold").click();
  await page.waitForURL(/\/trail\/\w+/);
  await page
    .getByTestId("print")
    .and(page.locator(":not([disabled])"))
    .waitFor({ timeout: 60_000 });
  return page.url().split("/trail/")[1]!;
}
