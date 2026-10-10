import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("privacy, terms and 404 render, link home, and pass axe", async ({ page }) => {
  for (const [path, heading] of [
    ["/privacy", /nobody/i],
    ["/terms", /walk safely/i],
  ] as const) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  }
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This page wandered off.")).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Privacy" })).toBeVisible();
});

test("share card, icons, robots, sitemap and manifest are served", async ({ request }) => {
  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
  expect((await og.body()).length).toBeGreaterThan(10_000);
  expect((await request.get("/apple-icon")).status()).toBe(200);
  expect((await request.get("/icon.svg")).status()).toBe(200);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain("Sitemap:");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("/privacy");
  expect((await (await request.get("/manifest.webmanifest")).json()).name).toBe("Paper Trail");
});

test("the landing page carries share metadata", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /http/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
});

test("the API refuses other sites and hides internals", async ({ request }) => {
  const cross = await request.post("/api/geocode", {
    headers: { "sec-fetch-site": "cross-site" },
    data: { q: "Cubbon Park" },
  });
  expect(cross.status()).toBe(403);
  expect((await cross.json()).code).toBe("forbidden");
  const report = await request.post("/api/client-error", {
    data: { kind: "runtime", message: "test", path: "/x?lat=1" },
  });
  expect(report.status()).toBe(204);
  const bad = await request.post("/api/client-error", { data: { kind: "nope" } });
  expect(bad.status()).toBe(400);
  const health = await (await request.get("/api/health")).json();
  expect(health.gate.budget.limit).toBe(2000);
});
