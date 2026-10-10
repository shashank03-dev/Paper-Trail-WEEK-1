export interface Preset {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  icon: string;
  blurb: string;
}

/** Demo presets with cached OSM data in fixtures/places, so demos work offline. */
export const PRESETS: Preset[] = [
  {
    id: "cubbon-park",
    name: "Cubbon Park",
    city: "Bengaluru",
    lat: 12.9763,
    lon: 77.5929,
    icon: "tree",
    blurb: "Rain trees, a red library and a bandstand.",
  },
  {
    id: "vondelpark",
    name: "Vondelpark",
    city: "Amsterdam",
    lat: 52.3584,
    lon: 4.8712,
    icon: "leaf",
    blurb: "Ponds, a rose garden and a Picasso.",
  },
  {
    id: "dolores-park",
    name: "Dolores Park",
    city: "San Francisco",
    lat: 37.7596,
    lon: -122.4269,
    icon: "weather",
    blurb: "Palms, a golden hydrant and a skyline hill.",
  },
];

export function presetById(id: string | undefined): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
