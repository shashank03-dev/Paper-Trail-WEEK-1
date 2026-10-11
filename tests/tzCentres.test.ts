import { describe, expect, it } from "vitest";
import { TZ_CENTRES } from "@/lib/tzCentres";

describe("time-zone regions for search", () => {
  it("knows the old names browsers still report", () => {
    expect(TZ_CENTRES["Asia/Calcutta"]).toEqual(TZ_CENTRES["Asia/Kolkata"]);
    expect(TZ_CENTRES["Asia/Saigon"]).toEqual(TZ_CENTRES["Asia/Ho_Chi_Minh"]);
    expect(TZ_CENTRES["Europe/Kiev"]).toEqual(TZ_CENTRES["Europe/Kyiv"]);
  });

  it("covers every inhabited zone the runtime knows", () => {
    const zones = Intl.supportedValuesOf("timeZone").filter((z) => z.includes("/"));
    const missing = zones.filter((z) => !TZ_CENTRES[z] && !z.startsWith("Etc/"));
    expect(missing).toEqual([]);
  });
});
