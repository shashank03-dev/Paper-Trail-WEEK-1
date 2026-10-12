import { describe, expect, it } from "vitest";
import { keepAwakeConfig } from "@/lib/server/keepAwake";

describe("keep-awake self ping", () => {
  it("is off unless the server knows its public URL", () => {
    expect(keepAwakeConfig({})).toBeNull();
    expect(keepAwakeConfig({ PUBLIC_URL: "http://localhost:3000" })).toBeNull();
  });

  it("pings /api/config on Render every 10 minutes by default", () => {
    expect(keepAwakeConfig({ RENDER_EXTERNAL_URL: "https://x.onrender.com" })).toEqual({
      url: "https://x.onrender.com/api/config",
      intervalMs: 600_000,
    });
  });

  it("honours KEEP_AWAKE_URL, the interval and the off switch", () => {
    expect(
      keepAwakeConfig({ KEEP_AWAKE_URL: "https://a.example/ping", KEEP_AWAKE_INTERVAL_MIN: "5" }),
    ).toEqual({ url: "https://a.example/ping", intervalMs: 300_000 });
    expect(
      keepAwakeConfig({ RENDER_EXTERNAL_URL: "https://x", KEEP_AWAKE_INTERVAL_MIN: "60" })
        ?.intervalMs,
    ).toBe(14 * 60_000);
    expect(keepAwakeConfig({ RENDER_EXTERNAL_URL: "https://x", KEEP_AWAKE: "off" })).toBeNull();
    expect(keepAwakeConfig({ KEEP_AWAKE_URL: "not a url" })).toBeNull();
  });
});
