import { expect, test } from "@playwright/test";
import { makeTrail } from "./helpers";

test("setup → generate → 8-panel preview matches the print layout", async ({ page }) => {
  await makeTrail(page);
  const sheet = page.getByTestId("sheet-preview").locator("svg").first();
  await expect(sheet.locator("[data-page]")).toHaveCount(8);
  await expect(sheet.locator(".panel-pending")).toHaveCount(0);
  await expect(page.getByTestId("gen-meta")).toContainText("gemma4:e4b");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Small Wonders/);
  // Print layout: 4×2, pages 5 4 3 2 over 6 7 8 1, fiducials in the corners.
  await expect(sheet.locator("[data-fiducial]")).toHaveCount(4);
  await page.mouse.move(0, 0);
  await expect(sheet).toHaveScreenshot("flat-sheet.png", { mask: [sheet.locator("[data-qr]")] });

  // The folded booklet flips through pages.
  await page.getByRole("radio", { name: "Folded booklet" }).click();
  await page.getByRole("button", { name: /turn/i }).click();
  await expect(page.getByText("2 · 3 / 8")).toBeVisible();
});

test("return with a photo → corners auto-detected → Field Report → stamp → Trail Book", async ({
  page,
}) => {
  const id = await makeTrail(page);
  await page.goto(`/return/${id}`);
  await page.getByTestId("photo-input").setInputFiles("fixtures/photos/sheet-00.jpg");
  await expect(page.getByTestId("corners-found")).toBeVisible();
  await page.getByTestId("read").click();
  const report = page.getByTestId("field-report");
  await expect(report).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("stamp")).toBeVisible();
  await expect(page.getByTestId("verdict")).toBeVisible();
  await expect(page.getByTestId("screen-time")).not.toHaveText("");
  await expect(report.getByText("a bus sighing at the stop")).toBeVisible();
  await page.getByTestId("add-to-book").click();
  await expect(page.getByTestId("add-to-book")).toHaveText(/In your Trail Book/);
  await page.goto("/book");
  await expect(page.getByTestId("book-card")).toHaveCount(1);
  await expect(page.getByTestId("stat-trails-walked")).toHaveText("1");
});

test("a trail from another device still gets read", async ({ page }) => {
  await page.goto("/return/notonthisdevice");
  await expect(page.getByText(/lives on the device that made it/)).toBeVisible();
  await page.getByTestId("photo-input").setInputFiles("fixtures/photos/sheet-01.jpg");
  await page.getByTestId("read").click();
  await expect(page.getByTestId("field-report")).toBeVisible({ timeout: 60_000 });
});

test("fold test page shows big page numbers", async ({ page }) => {
  await page.goto("/fold-test");
  await expect(page.getByRole("img", { name: /fold test sheet/i })).toBeVisible();
  await expect(page.getByText("top row 5 4 3 2")).toBeVisible();
});
