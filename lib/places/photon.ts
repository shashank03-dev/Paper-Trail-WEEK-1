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
