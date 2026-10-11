import { expect, test } from "@playwright/test";

/*
 * Search as you type on the setup page. Geocoding is mocked so the test never
 * depends on a public service: suggestions must appear without pressing
 * Search, typing fast must not send a request per key, arrows + Enter pick,
 * and the full search (Enter with nothing highlighted) still works.
 */
test("suggestions appear while typing and can be picked with the keyboard", async ({ page }) => {
  const calls: { q: string; mode: string }[] = [];
  await page.route("**/api/geocode", async (route) => {
    const body = route.request().postDataJSON() as { q: string; mode?: string };
    calls.push({ q: body.q, mode: body.mode ?? "search" });
    const results =
      body.mode === "suggest"
        ? [
            { label: "Cubbon Park, Bengaluru, Karnataka", lat: 12.9763, lon: 77.5929 },
            { label: "Cubbon Road, Bengaluru, Karnataka", lat: 12.979, lon: 77.6 },
          ]
        : [{ label: "Cubbonpet, Bengaluru", lat: 12.965, lon: 77.578 }];
    await route.fulfill({ json: { results } });
  });
  await page.goto("/new");
  const box = page.getByRole("combobox", { name: /search for a street or place/i });
  await box.pressSequentially("cubbon", { delay: 40 });

  const list = page.getByRole("listbox", { name: "Places" });
  await expect(list.getByRole("option")).toHaveCount(2);
  // Debounced: one suggestion request for the whole word, not one per key.
  expect(calls.filter((c) => c.mode === "suggest").map((c) => c.q)).toEqual(["cubbon"]);
  await expect(list.getByRole("option").first().locator("strong")).toHaveText("Cubbon");

  await box.press("ArrowDown");
  await box.press("ArrowDown");
  await expect(list.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(list).toBeHidden();
  await expect(box).toHaveValue("Cubbon Road, Bengaluru, Karnataka");
  await expect(page.getByText("Takes about a minute.")).toBeVisible();
  // Picking doesn't search again.
  await page.waitForTimeout(500);
  expect(calls.filter((c) => c.mode === "suggest")).toHaveLength(1);

  // Escape closes; Enter with nothing highlighted runs the full search.
  await box.fill("cubbonpet");
  await expect(list.getByRole("option")).toHaveCount(2);
  await box.press("Escape");
  await expect(list).toBeHidden();
  await box.press("Enter");
  await expect(list.getByRole("option")).toHaveText(["Cubbonpet, Bengaluru"]);
  expect(calls.at(-1)).toEqual({ q: "cubbonpet", mode: "search" });

  // A tap picks too.
  await list.getByRole("option").first().click();
  await expect(box).toHaveValue("Cubbonpet, Bengaluru");
});

test("nothing is suggested for one or two letters, and a dead suggester stays quiet", async ({
  page,
}) => {
  let n = 0;
  await page.route("**/api/geocode", (route) => {
    n++;
    return route.fulfill({ json: { results: [], unavailable: true } });
  });
  await page.goto("/new");
  const box = page.getByRole("combobox", { name: /search for a street or place/i });
  await box.pressSequentially("ab", { delay: 40 });
  await page.waitForTimeout(600);
  expect(n).toBe(0);
  await box.pressSequentially("c", { delay: 40 });
  await expect(page.getByRole("listbox", { name: "Places" })).toBeHidden();
  await expect(page.locator(".notice-error")).toHaveCount(0);
});

test.describe("nearby first", () => {
  test.use({ timezoneId: "Asia/Kolkata" });

  test("suggestions lean toward the time zone, then toward the picked spot, with distances", async ({
    page,
  }) => {
    const bodies: { q: string; near?: { lat: number; lon: number; precise: boolean } }[] = [];
    await page.route("**/api/geocode", async (route) => {
      const body = route.request().postDataJSON() as (typeof bodies)[number];
      bodies.push(body);
      await route.fulfill({
        json: {
          results: body.near?.precise
            ? [{ label: "Kodigehalli, Yelahanka", lat: 13.054, lon: 77.572, distanceM: 2400 }]
            : [{ label: "Kodigehalli, Husenpura", lat: 13.44, lon: 77.99 }],
        },
      });
    });
    await page.goto("/new");
    const box = page.getByRole("combobox", { name: /search for a street or place/i });
    const list = page.getByRole("listbox", { name: "Places" });

    // First visit, no location shared: a region from the time zone, marked imprecise.
    await box.pressSequentially("kodige", { delay: 30 });
    await expect(list.getByRole("option")).toHaveText(["Kodigehalli, Husenpura"]);
    // (If typing beats the hint, the list is asked again once it arrives.)
    await expect.poll(() => bodies.at(-1)?.near).toEqual({ lat: 22.5, lon: 88.4, precise: false });

    // Once a spot is picked, it leads, rounded to ~1 km, and distances show.
    await list.getByRole("option").first().click();
    await box.fill("kodigeh");
    await expect(list.getByRole("option")).toHaveText(["Kodigehalli, Yelahanka2.4 km"]);
    expect(bodies.at(-1)!.near).toEqual({ lat: 13.44, lon: 77.99, precise: true });
  });
});
