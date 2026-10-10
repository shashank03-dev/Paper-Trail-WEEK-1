import { expect, test } from "@playwright/test";

test("settings → test connection (mocked model)", async ({ page }) => {
  await page.goto("/settings");
  await page.getByTestId("test-connection").click();
  await expect(page.getByTestId("test-result")).toContainText(/gemma4:e4b answered in \d+ ms/);
});

test("the landing badge shows the live model", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "Runs on Gemma 4" })).toContainText(
    "on your machine",
  );
});
