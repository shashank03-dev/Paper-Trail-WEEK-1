import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
await p.route("**/api/geocode", (r) => r.fulfill({ json: { results: [
  { label: "Kodigehalli Gate, Bengaluru, Karnataka", lat: 13.057, lon: 77.594 },
  { label: "Kodigehalli Lake, Bengaluru, Karnataka", lat: 13.06, lon: 77.59 },
  { label: "Kodigehalli Main Road, Bengaluru, Karnataka", lat: 13.05, lon: 77.58 },
  { label: "Kodigehalli, Bengaluru North, Karnataka", lat: 13.05, lon: 77.58 } ] } }));
await p.goto("http://localhost:3311/new");
const box = p.getByRole("combobox");
await box.scrollIntoViewIfNeeded();
await box.pressSequentially("kodige", { delay: 30 });
await p.waitForTimeout(800);
await p.screenshot({ path: process.argv[2] });
await b.close();
