import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3210);
const MOCK = Number(process.env.MOCK_LLM_PORT ?? 11435);

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    {
      command: `MOCK_LLM_PORT=${MOCK} pnpm mock:llm`,
      url: `http://127.0.0.1:${MOCK}/v1/models`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // A production build talking to the mock model (NOT a real model).
      command: `pnpm build && pnpm start -p ${PORT}`,
      url: `http://localhost:${PORT}/api/config`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        LLM_BASE_URL: `http://127.0.0.1:${MOCK}/v1`,
        LLM_MODEL_TEXT: "gemma4:e4b",
        LLM_MODEL_VISION: "gemma4:e4b",
        DEMO_MODE: "false",
        RATE_LIMIT: "off",
        PUBLIC_URL: `http://localhost:${PORT}`,
        DEVICE_LABEL: "a test runner",
      },
    },
  ],
});
