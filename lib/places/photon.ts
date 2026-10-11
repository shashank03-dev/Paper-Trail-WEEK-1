/**
 * Photon (komoot's OpenStreetMap geocoder) is built for search-as-you-type;
 * Nominatim's usage policy forbids autocomplete, so suggestions come from
 * here and a full search (Enter) still goes to Nominatim.
 */
export interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
}

export interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  /** From the bias point, when it was a real spot (not a time-zone region). */
  distanceM?: number;
}

export interface NearBias {
  lat: number;
  lon: number;
  precise: boolean;
}

/**
 * Photon query parameters. With a bias point, nearby places rank first: a real
 * spot pulls hard (city scale), a time-zone region only nudges (country scale).
 */
export function photonParams(q: string, lang: string, near?: NearBias): Record<string, string> {
  return {
    q,
    limit: "8",
    // Photon speaks a handful of languages; others get local names.
    ...(["en", "de", "fr", "it"].includes(lang) ? { lang } : {}),
    ...(near
      ? {
          lat: near.lat.toFixed(2),
          lon: near.lon.toFixed(2),
          zoom: near.precise ? "12" : "5",
          location_bias_scale: near.precise ? "0.2" : "0.5",
        }
      : {}),
  };
}

/** "Dolores Park, Mission District, San Francisco" — the name, then where it is, no repeats. */
export function photonLabel(p: PhotonFeature["properties"]): string {
  const street = p.street ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ""}` : undefined;
  const parts = [p.name, street, p.district ?? p.locality, p.city ?? p.county, p.state, p.country];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const v = part?.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length === 3) break;
  }
  return out.join(", ").slice(0, 120);
}

export function photonSuggestions(raw: { features?: PhotonFeature[] }): Suggestion[] {
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const f of raw.features ?? []) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const label = photonLabel(f.properties ?? {});
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, lat, lon });
  }
  return out.slice(0, 6);
}
