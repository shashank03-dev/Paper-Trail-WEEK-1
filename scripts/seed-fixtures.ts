/**
 * Builds the three demo presets from HAND-TRACED seeds in Overpass format,
 * then runs them through the same normaliser as live Overpass data.
 *
 * These are approximations so the app works offline out of the box. Feature
 * names are real places; positions and street geometry are traced by hand and
 * can be off by tens of metres. Run `pnpm fixtures:fetch` with network to
 * replace them with real OpenStreetMap data.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { normalizeOverpass, type OverpassElement } from "@/lib/places/overpass";
import { PRESETS } from "@/lib/presets";
import type { Weather } from "@/lib/schemas";

let nextId = 9_000_000;
const node = (lat: number, lon: number, tags: Record<string, string>): OverpassElement => ({
  type: "node",
  id: nextId++,
  lat,
  lon,
  tags,
});
const way = (tags: Record<string, string>, pts: [number, number][]): OverpassElement => ({
  type: "way",
  id: nextId++,
  tags,
  geometry: pts.map(([lat, lon]) => ({ lat, lon })),
});
const closed = (pts: [number, number][]): [number, number][] => [...pts, pts[0]!];

/* ------------------------------ Dolores Park ------------------------------ */
function dolores(): OverpassElement[] {
  const latSt: [string, number, string][] = [
    ["16th Street", 37.7648, "secondary"],
    ["17th Street", 37.7632, "residential"],
    ["18th Street", 37.7615, "secondary"],
    ["20th Street", 37.7583, "residential"],
    ["21st Street", 37.7567, "residential"],
    ["22nd Street", 37.7551, "residential"],
  ];
  const lonSt: [string, number, string][] = [
    ["Valencia Street", -122.4216, "tertiary"],
    ["Guerrero Street", -122.4237, "secondary"],
    ["Dolores Street", -122.4258, "tertiary"],
    ["Church Street", -122.4285, "tertiary"],
    ["Sanchez Street", -122.4307, "residential"],
    ["Noe Street", -122.4329, "residential"],
  ];
  const els: OverpassElement[] = [];
  for (const [name, lat, hw] of latSt)
    els.push(
      way({ highway: hw, name }, [
        [lat + 0.0003, -122.4345],
        [lat, -122.428],
        [lat - 0.0003, -122.42],
      ]),
    );
  for (const [name, lon, hw] of lonSt)
    els.push(
      way({ highway: hw, name }, [
        [37.7665, lon + 0.0002],
        [37.76, lon],
        [37.7535, lon - 0.0002],
      ]),
    );
  els.push(
    way({ highway: "residential", name: "19th Street" }, [
      [37.76, -122.4345],
      [37.7599, -122.4285],
    ]),
  );
  els.push(
    way({ highway: "residential", name: "19th Street" }, [
      [37.7599, -122.4258],
      [37.7598, -122.42],
    ]),
  );
  els.push(
    way({ highway: "residential", name: "Cumberland Street" }, [
      [37.7591, -122.4285],
      [37.7591, -122.4329],
    ]),
  );
  els.push(
    way({ highway: "residential", name: "Liberty Street" }, [
      [37.7575, -122.4216],
      [37.7575, -122.4307],
    ]),
  );
  els.push(
    way(
      { leisure: "park", name: "Mission Dolores Park" },
      closed([
        [37.7615, -122.4283],
        [37.7615, -122.4259],
        [37.7583, -122.4259],
        [37.7583, -122.4283],
      ]),
    ),
  );
  els.push(
    way({ highway: "footway" }, [
      [37.7614, -122.426],
      [37.76, -122.427],
      [37.7585, -122.4281],
    ]),
  );
  els.push(
    way({ highway: "footway" }, [
      [37.7614, -122.4282],
      [37.7603, -122.4275],
      [37.759, -122.4262],
    ]),
  );
  els.push(
    way({ highway: "footway" }, [
      [37.7598, -122.4282],
      [37.7598, -122.426],
    ]),
  );
  els.push(
    way({ highway: "path" }, [
      [37.7608, -122.4282],
      [37.7606, -122.4268],
      [37.7612, -122.4262],
    ]),
  );
  els.push(
    node(37.7583, -122.4285, {
      historic: "yes",
      name: "Golden Fire Hydrant",
      start_date: "1906",
      colour: "gold",
    }),
    node(37.7612, -122.4263, {
      historic: "memorial",
      memorial: "statue",
      name: "Miguel Hidalgo statue",
    }),
    node(37.7609, -122.4266, {
      historic: "memorial",
      name: "Mexican Liberty Bell replica",
      material: "bronze",
    }),
    node(37.7607, -122.4278, { leisure: "playground", name: "Helen Diller Playground" }),
    node(37.7587, -122.4279, { tourism: "viewpoint", name: "Dolores Park hilltop" }),
    node(37.7642, -122.427, { historic: "building", name: "Mission Dolores", start_date: "1791" }),
    node(37.762, -122.4279, { historic: "building", name: "Mission High School" }),
    node(37.7616, -122.4252, { amenity: "cafe", name: "Bi-Rite Creamery", cuisine: "ice_cream" }),
    node(37.7614, -122.4241, { shop: "bakery", name: "Tartine Bakery" }),
    node(37.7613, -122.4256, { amenity: "cafe", name: "Dolores Park Cafe" }),
    node(37.7618, -122.4226, { tourism: "artwork", artwork_type: "mural", name: "MaestraPeace" }),
    node(37.759, -122.4281, { man_made: "bridge", name: "Dolores Park footbridge" }),
    node(37.7584, -122.4287, { highway: "bus_stop", name: "Church St & 20th St" }),
    node(37.7614, -122.4287, { highway: "bus_stop", name: "Church St & 18th St" }),
    node(37.7616, -122.4286, { amenity: "post_box" }),
    node(37.7605, -122.427, { amenity: "drinking_water" }),
    node(37.7592, -122.4265, { amenity: "drinking_water" }),
    node(37.76, -122.4277, { amenity: "bench" }),
    node(37.7595, -122.4268, { amenity: "bench", inscription: "yes" }),
    node(37.7588, -122.4274, { amenity: "bench" }),
    node(37.7611, -122.4271, { amenity: "waste_basket" }),
    node(37.7612, -122.4259, { amenity: "bicycle_parking" }),
    node(37.76, -122.4258, { natural: "tree", genus: "Phoenix", species: "Phoenix canariensis" }),
    node(37.759, -122.4258, { natural: "tree", genus: "Phoenix", species: "Phoenix canariensis" }),
    node(37.7623, -122.4258, { natural: "tree", genus: "Phoenix", species: "Phoenix canariensis" }),
    node(37.7594, -122.4279, { natural: "tree", species: "Cupressus macrocarpa" }),
    node(37.7603, -122.4262, { natural: "tree" }),
    node(37.7586, -122.4266, { natural: "tree", leaf_type: "broadleaved" }),
    node(37.7598, -122.4284, { highway: "street_lamp" }),
    node(37.7631, -122.4258, { highway: "street_lamp" }),
  );
  return els;
}

/* -------------------------------- Vondelpark ------------------------------ */
function vondel(): OverpassElement[] {
  const els: OverpassElement[] = [];
  const north: [number, number][] = [
    [52.3618, 4.8795],
    [52.3608, 4.8745],
    [52.3594, 4.869],
    [52.358, 4.8635],
    [52.3566, 4.8578],
  ];
  const south: [number, number][] = [
    [52.3549, 4.859],
    [52.3561, 4.8645],
    [52.3574, 4.87],
    [52.3588, 4.876],
    [52.36, 4.8812],
  ];
  els.push(way({ leisure: "park", name: "Vondelpark" }, closed([...north, ...south])));
  els.push(
    way(
      { natural: "water" },
      closed([
        [52.3597, 4.8758],
        [52.3594, 4.8772],
        [52.3586, 4.8748],
        [52.3582, 4.8722],
        [52.3587, 4.8717],
        [52.3591, 4.8738],
      ]),
    ),
  );
  els.push(
    way(
      { natural: "water" },
      closed([
        [52.3574, 4.866],
        [52.3571, 4.8672],
        [52.3565, 4.865],
        [52.3562, 4.863],
        [52.3567, 4.8628],
      ]),
    ),
  );
  els.push(
    way({ highway: "residential", name: "Vondelstraat" }, [
      [52.3628, 4.8793],
      [52.3619, 4.8745],
      [52.361, 4.87],
    ]),
  );
  els.push(
    way({ highway: "secondary", name: "Overtoom" }, [
      [52.364, 4.879],
      [52.3625, 4.871],
      [52.3607, 4.862],
      [52.359, 4.856],
    ]),
  );
  els.push(
    way({ highway: "secondary", name: "Van Baerlestraat" }, [
      [52.363, 4.8738],
      [52.3604, 4.8757],
      [52.3578, 4.8778],
      [52.356, 4.879],
    ]),
  );
  els.push(
    way({ highway: "tertiary", name: "Koninginneweg" }, [
      [52.3552, 4.8712],
      [52.3547, 4.865],
      [52.3541, 4.859],
    ]),
  );
  els.push(
    way({ highway: "residential", name: "Emmalaan" }, [
      [52.3566, 4.869],
      [52.3545, 4.87],
    ]),
  );
  els.push(
    way({ highway: "residential", name: "Van Eeghenstraat" }, [
      [52.3586, 4.88],
      [52.3577, 4.8745],
      [52.3566, 4.8695],
    ]),
  );
  els.push(
    way({ highway: "secondary", name: "Amstelveenseweg" }, [
      [52.359, 4.8565],
      [52.3555, 4.8582],
      [52.3525, 4.8595],
    ]),
  );
  els.push(
    way({ highway: "tertiary", name: "Stadhouderskade" }, [
      [52.363, 4.8805],
      [52.3612, 4.883],
    ]),
  );
  els.push(
    way({ highway: "cycleway" }, [
      [52.361, 4.88],
      [52.3596, 4.874],
      [52.3584, 4.869],
      [52.3571, 4.8635],
      [52.3559, 4.859],
    ]),
  );
  els.push(
    way({ highway: "footway" }, [
      [52.3605, 4.879],
      [52.359, 4.8752],
      [52.3579, 4.8712],
      [52.3567, 4.8665],
    ]),
  );
  els.push(
    way({ highway: "footway" }, [
      [52.3599, 4.8705],
      [52.3583, 4.8716],
      [52.3576, 4.8728],
    ]),
  );
  els.push(
    way({ highway: "footway" }, [
      [52.3586, 4.8665],
      [52.357, 4.867],
      [52.3561, 4.8676],
    ]),
  );
  els.push(
    node(52.3583, 4.8716, { amenity: "cafe", name: "'t Blauwe Theehuis" }),
    node(52.36, 4.8774, {
      historic: "memorial",
      memorial: "statue",
      name: "Joost van den Vondel statue",
    }),
    node(52.3567, 4.8656, {
      tourism: "artwork",
      artwork_type: "sculpture",
      artist_name: "Pablo Picasso",
      name: "Figure découpée l'Oiseau",
    }),
    node(52.3566, 4.8692, { leisure: "garden", name: "Rosarium" }),
    node(52.3572, 4.8667, { amenity: "cafe", name: "Het Groot Melkhuis" }),
    node(52.357, 4.8673, { leisure: "playground", name: "Speeltuin Groot Melkhuis" }),
    node(52.3614, 4.874, { historic: "building", name: "Vondelkerk", start_date: "1880" }),
    node(52.3614, 4.8773, { historic: "building", name: "Hollandsche Manege" }),
    node(52.3601, 4.8779, { historic: "building", name: "Vondelpark Paviljoen" }),
    node(52.3603, 4.876, { man_made: "bridge", name: "Vondeltunnel" }),
    node(52.3589, 4.874, { amenity: "fountain" }),
    node(52.3595, 4.8762, { amenity: "drinking_water" }),
    node(52.3577, 4.87, { amenity: "drinking_water" }),
    node(52.3612, 4.879, { amenity: "bicycle_parking" }),
    node(52.362, 4.8752, { amenity: "post_box" }),
    node(52.359, 4.8725, { amenity: "bench" }),
    node(52.3581, 4.8705, { amenity: "bench", inscription: "yes" }),
    node(52.3575, 4.868, { amenity: "bench" }),
    node(52.3592, 4.8748, { natural: "tree", genus: "Platanus", species: "Platanus x hispanica" }),
    node(52.3585, 4.873, { natural: "tree", genus: "Taxodium", species: "Taxodium distichum" }),
    node(52.3578, 4.869, { natural: "tree", genus: "Salix" }),
    node(52.3569, 4.8645, { natural: "tree", leaf_type: "broadleaved" }),
    node(52.3596, 4.8735, { natural: "tree" }),
    node(52.3606, 4.8786, { highway: "street_lamp" }),
    node(52.3622, 4.8742, { highway: "bus_stop", name: "Van Baerlestraat" }),
  );
  return els;
}

/* ------------------------------- Cubbon Park ------------------------------ */
function cubbon(): OverpassElement[] {
  const els: OverpassElement[] = [];
  els.push(
    way(
      { leisure: "park", name: "Cubbon Park" },
      closed([
        [12.9808, 77.5898],
        [12.98, 77.5958],
        [12.9772, 77.599],
        [12.9732, 77.5976],
        [12.9702, 77.5942],
        [12.9714, 77.5893],
        [12.976, 77.5881],
      ]),
    ),
  );
  els.push(
    way(
      { natural: "wood", name: "Bamboo grove" },
      closed([
        [12.9756, 77.5906],
        [12.9752, 77.5922],
        [12.9743, 77.592],
        [12.9745, 77.5905],
      ]),
    ),
  );
  els.push(
    way({ highway: "primary", name: "Kasturba Road" }, [
      [12.97, 77.5952],
      [12.974, 77.5966],
      [12.9765, 77.5986],
      [12.9777, 77.6008],
    ]),
  );
  els.push(
    way({ highway: "secondary", name: "Ambedkar Veedhi" }, [
      [12.9803, 77.5872],
      [12.9806, 77.5935],
      [12.9794, 77.5985],
    ]),
  );
  els.push(
    way({ highway: "primary", name: "Nrupathunga Road" }, [
      [12.97, 77.5868],
      [12.974, 77.5874],
      [12.9778, 77.5878],
    ]),
  );
  els.push(
    way({ highway: "secondary", name: "Mahatma Gandhi Road" }, [
      [12.9757, 77.6],
      [12.9752, 77.606],
    ]),
  );
  els.push(
    way({ highway: "tertiary", name: "Raj Bhavan Road" }, [
      [12.9794, 77.5985],
      [12.983, 77.5935],
    ]),
  );
  els.push(
    way({ highway: "service", name: "Sri Chamarajendra Road" }, [
      [12.979, 77.5905],
      [12.9765, 77.5932],
      [12.9741, 77.5946],
      [12.9712, 77.595],
    ]),
  );
  els.push(
    way({ highway: "service", name: "Cubbon Park Road" }, [
      [12.976, 77.5884],
      [12.9763, 77.5925],
      [12.9756, 77.5966],
    ]),
  );
  els.push(
    way({ highway: "footway" }, [
      [12.9785, 77.5935],
      [12.977, 77.5955],
      [12.9762, 77.5975],
    ]),
  );
  els.push(
    way({ highway: "footway" }, [
      [12.9735, 77.5905],
      [12.9746, 77.593],
      [12.9733, 77.5958],
    ]),
  );
  els.push(
    way({ highway: "path" }, [
      [12.9775, 77.59],
      [12.9768, 77.5915],
      [12.9762, 77.5929],
      [12.9758, 77.5945],
    ]),
  );
  els.push(
    way({ highway: "path" }, [
      [12.9725, 77.592],
      [12.9718, 77.5935],
      [12.9726, 77.5948],
    ]),
  );
  els.push(
    node(12.9746, 77.5939, {
      amenity: "library",
      name: "State Central Library",
      start_date: "1915",
      colour: "red",
    }),
    node(12.979, 77.5917, {
      historic: "building",
      name: "Attara Kacheri",
      start_date: "1868",
      colour: "red",
    }),
    node(12.9741, 77.5959, { historic: "building", name: "Government Museum" }),
    node(12.9762, 77.5944, { historic: "building", name: "Cubbon Park Bandstand" }),
    node(12.9757, 77.5986, {
      historic: "memorial",
      memorial: "statue",
      name: "Queen Victoria statue",
      material: "marble",
    }),
    node(12.9771, 77.5966, {
      historic: "memorial",
      memorial: "statue",
      name: "King Edward VII statue",
    }),
    node(12.9786, 77.5926, {
      historic: "memorial",
      memorial: "statue",
      name: "Sir Mark Cubbon statue",
    }),
    node(12.9728, 77.5928, { leisure: "playground", name: "Jawahar Bal Bhavan" }),
    node(12.9766, 77.594, { amenity: "fountain" }),
    node(12.9744, 77.5966, { highway: "bus_stop", name: "Cubbon Park" }),
    node(12.9788, 77.5912, { amenity: "post_box" }),
    node(12.9758, 77.5934, { amenity: "drinking_water" }),
    node(12.9735, 77.5944, { amenity: "drinking_water" }),
    node(12.976, 77.5925, { amenity: "bench" }),
    node(12.9751, 77.595, { amenity: "bench" }),
    node(12.977, 77.5935, { amenity: "bench", inscription: "yes" }),
    node(12.9765, 77.5918, { natural: "tree", species: "Samanea saman" }),
    node(12.9754, 77.5935, { natural: "tree", genus: "Ficus" }),
    node(12.9779, 77.5948, { natural: "tree", species: "Spathodea campanulata" }),
    node(12.9739, 77.5925, { natural: "tree", species: "Peltophorum pterocarpum" }),
    node(12.9768, 77.5957, { natural: "tree" }),
    node(12.9749, 77.5943, { highway: "street_lamp" }),
    node(12.9772, 77.5925, { highway: "street_lamp" }),
    node(12.9737, 77.5952, { amenity: "cafe" }),
    node(12.9719, 77.5939, { amenity: "waste_basket" }),
  );
  return els;
}

const WEATHER: Record<string, Weather> = {
  "cubbon-park": {
    tempC: 27,
    condition: "partly-cloudy",
    precipProbNext2h: 20,
    windKph: 9,
    sunset: "18:05",
    isDaylight: true,
  },
  vondelpark: {
    tempC: 12,
    condition: "drizzle",
    precipProbNext2h: 65,
    windKph: 18,
    sunset: "18:58",
    isDaylight: true,
  },
  "dolores-park": {
    tempC: 19,
    condition: "clear",
    precipProbNext2h: 0,
    windKph: 14,
    sunset: "18:40",
    isDaylight: true,
  },
};

const SEEDS: Record<string, () => OverpassElement[]> = {
  "cubbon-park": cubbon,
  vondelpark: vondel,
  "dolores-park": dolores,
};

mkdirSync("fixtures/places", { recursive: true });
mkdirSync("fixtures/weather", { recursive: true });
mkdirSync("fixtures/overpass", { recursive: true });
for (const p of PRESETS) {
  const raw = { elements: SEEDS[p.id]!() };
  const places = normalizeOverpass(raw, p.lat, p.lon, 900);
  const meta = {
    preset: p.id,
    center: { lat: p.lat, lon: p.lon },
    radiusM: 900,
    source: "hand-traced",
    note: "Hand-traced approximation of OpenStreetMap data for offline demos. Run `pnpm fixtures:fetch` to replace with live OSM. © OpenStreetMap contributors (ODbL).",
  };
  writeFileSync(`fixtures/overpass/${p.id}.json`, JSON.stringify(raw, null, 1));
  writeFileSync(`fixtures/places/${p.id}.json`, JSON.stringify({ meta, ...places }, null, 1));
  writeFileSync(`fixtures/weather/${p.id}.json`, JSON.stringify(WEATHER[p.id], null, 2));
  console.log(`${p.id}: ${places.features.length} features, ${places.ways.length} ways`);
}
