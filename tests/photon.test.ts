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
