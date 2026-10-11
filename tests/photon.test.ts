import { describe, expect, it } from "vitest";
import { photonLabel, photonSuggestions, type PhotonFeature } from "@/lib/places/photon";

const f = (props: PhotonFeature["properties"], lon = 77.59, lat = 12.97): PhotonFeature => ({
  geometry: { coordinates: [lon, lat] },
  properties: props,
});

describe("Photon suggestions", () => {
  it("labels a place by name, then where it is, without repeats", () => {
    expect(
      photonLabel({ name: "Cubbon Park", city: "Bengaluru", state: "Karnataka", country: "India" }),
    ).toBe("Cubbon Park, Bengaluru, Karnataka");
    expect(photonLabel({ name: "Bengaluru", city: "Bengaluru", country: "India" })).toBe(
      "Bengaluru, India",
    );
    expect(photonLabel({ street: "Church Street", housenumber: "12", city: "Bengaluru" })).toBe(
      "Church Street 12, Bengaluru",
    );
  });

  it("keeps coordinates as lat/lon, drops duplicates and broken entries, caps the list", () => {
    const raw = {
      features: [
        f({ name: "Cubbon Park", city: "Bengaluru" }),
        f({ name: "Cubbon Park", city: "Bengaluru" }, 77.6, 12.98),
        {
          geometry: { coordinates: [] },
          properties: { name: "Nowhere" },
        } as unknown as PhotonFeature,
        ...Array.from({ length: 10 }, (_, i) => f({ name: `Place ${i}` })),
      ],
    };
    const out = photonSuggestions(raw);
    expect(out[0]).toEqual({ label: "Cubbon Park, Bengaluru", lat: 12.97, lon: 77.59 });
    expect(out.filter((s) => s.label.startsWith("Cubbon"))).toHaveLength(1);
    expect(out.some((s) => s.label === "Nowhere")).toBe(false);
    expect(out).toHaveLength(6);
  });

  it("copes with an empty or odd answer", () => {
    expect(photonSuggestions({})).toEqual([]);
  });
});

describe("nearby first", () => {
  it("biases hard toward a real spot and only nudges toward a time-zone region", async () => {
    const { photonParams } = await import("@/lib/places/photon");
    expect(photonParams("kodige", "en", { lat: 13.0412, lon: 77.5938, precise: true })).toEqual({
      q: "kodige",
      limit: "8",
      lang: "en",
      lat: "13.04",
      lon: "77.59",
      zoom: "12",
      location_bias_scale: "0.2",
    });
    expect(photonParams("kodige", "kn", { lat: 22.5, lon: 88.4, precise: false })).toMatchObject({
      zoom: "5",
      location_bias_scale: "0.5",
    });
    expect(photonParams("kodige", "kn")).toEqual({ q: "kodige", limit: "8" });
  });

  it("writes distances the way a walker reads them", async () => {
    const { formatDistance } = await import("@/components/PlaceSearch");
    expect(formatDistance(12)).toBe("50 m");
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(2440)).toBe("2.4 km");
    expect(formatDistance(38_400)).toBe("38 km");
    expect(formatDistance(1_234_000)).toBe("1,234 km");
  });
});
