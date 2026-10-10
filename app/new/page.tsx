"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon3D, type Icon3DName } from "@/components/Icon3D";
import { PRESETS } from "@/lib/presets";
import {
  RADIUS_BY_DURATION,
  type Companions,
  type Duration,
  type Places,
  type Weather,
} from "@/lib/schemas";
import { buildContext } from "@/lib/writer/context";
import { getConfig, postJSON } from "@/lib/client/api";
import { adoptPendingSessions, db, nextEdition, PENDING } from "@/lib/client/db";
import { defaultPaper } from "@/lib/client/settings";
import { newTrailId } from "@/lib/client/trail";
import { useScreenTime } from "@/lib/client/useScreenTime";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-desk" />,
});

type Where = { lat: number; lon: number; label: string; presetId?: string };

const WHO: { id: Companions; label: string; icon: Icon3DName }[] = [
  { id: "solo", label: "Solo", icon: "walker" },
  { id: "kids", label: "With kids", icon: "child" },
  { id: "dog", label: "With a dog", icon: "dog" },
  { id: "friend", label: "With a friend", icon: "friends" },
];

export default function NewTrail() {
  const router = useRouter();
  useScreenTime(PENDING, "setup");
  const [where, setWhere] = useState<Where | null>(null);
  const [duration, setDuration] = useState<Duration>(20);
  const [who, setWho] = useState<Companions>("solo");
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Where[] | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    void getConfig().then((c) => setDemo(c.demoMode));
  }, []);

  const locate = () => {
    setError(null);
    if (!navigator.geolocation)
      return setError("This browser can't share its location. Try search or a preset.");
    setBusy("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(null);
        setWhere({ lat: p.coords.latitude, lon: p.coords.longitude, label: "Right here" });
      },
      () => {
        setBusy(null);
        setError("Location was blocked. Search for a street or pick a preset instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setError(null);
    setBusy("Searching…");
    try {
      const r = await postJSON<{ results: Where[] }>("/api/geocode", { q });
      setResults(r.results);
      if (!r.results.length) setError("Nothing found. Try a street and city.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const fold = async () => {
    if (!where) return;
    setError(null);
    try {
      setBusy("Reading the map around you…");
      const radiusM = RADIUS_BY_DURATION[duration];
      const [places, weather, cfg] = await Promise.all([
        postJSON<Places & { presetId?: string }>("/api/places", {
          lat: where.lat,
          lon: where.lon,
          radiusM,
          ...(where.presetId ? { presetId: where.presetId } : {}),
        }),
        postJSON<Weather>("/api/weather", {
          lat: where.lat,
          lon: where.lon,
          ...(where.presetId ? { presetId: where.presetId } : {}),
        }),
        getConfig(),
      ]);
      if (places.features.length < 3)
        throw new Error(
          "OpenStreetMap is thin here (fewer than 3 mapped places). Try a longer walk, another spot, or a preset.",
        );
      setBusy("Planning a loop…");
      const edition = await nextEdition();
      const presetId = where.presetId ?? places.presetId;
      const weatherClean: Weather = {
        tempC: weather.tempC,
        condition: weather.condition,
        precipProbNext2h: weather.precipProbNext2h,
        windKph: weather.windKph,
        sunset: weather.sunset,
        isDaylight: weather.isDaylight,
      };
      const ctx = buildContext({
        places,
        weather: weatherClean,
        location: { lat: where.lat, lon: where.lon, label: where.label },
        durationMin: duration,
        companions: who,
        walkerName: name.trim() || undefined,
        edition,
        presetId,
      });
      const id = newTrailId();
      await db().trails.add({
        id,
        createdAt: Date.now(),
        location: ctx.location,
        ...(presetId ? { presetId } : {}),
        durationMin: duration,
        companions: who,
        ...(ctx.walkerName ? { walkerName: ctx.walkerName } : {}),
        edition,
        paper: defaultPaper(),
        color: false,
        panels: {},
        route: ctx.route,
        features: ctx.features,
        ways: places.ways,
        weather: weatherClean,
        localTime: ctx.localTime,
        model: cfg.modelText,
        ...(cfg.hosted ? { hostedOn: cfg.endpointLabel } : {}),
        genPaths: {},
      });
      await adoptPendingSessions(id);
      router.push(`/trail/${id}`);
    } catch (err) {
      setBusy(null);
      setError((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-4 sm:px-6">
      <p className="kicker">One screen. No wizard.</p>
      <h1 className="display riso mt-2 text-4xl sm:text-5xl">Where are you walking?</h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 sm:p-6" aria-labelledby="where">
          <h2 id="where" className="display flex items-center gap-2 text-2xl">
            <Icon3D name="map" size={34} /> Where
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn btn-teal" onClick={locate}>
              <Icon3D name="compass" size={22} /> Use my location
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setShowMap((s) => !s)}
              aria-expanded={showMap}
            >
              {showMap ? "Hide map" : "Pick on a map"}
            </button>
          </div>
          <form onSubmit={search} className="mt-4 flex gap-2" role="search">
            <label htmlFor="q" className="sr-only">
              Search for a street or place
            </label>
            <input
              id="q"
              className="field"
              placeholder="Search a street, park or neighbourhood"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn" type="submit">
              Search
            </button>
          </form>
          {results && results.length > 0 && (
            <ul className="mt-3 divide-y-2 divide-dashed divide-line overflow-hidden rounded-xl border-2 border-ink bg-card">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    type="button"
                    className="w-full px-4 py-2.5 text-left hover:bg-desk"
                    onClick={() => (setWhere(r), setResults(null))}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showMap && (
            <div className="mt-4">
              <LocationPicker
                lat={where?.lat ?? 51.5072}
                lon={where?.lon ?? -0.1276}
                onPick={(lat, lon) =>
                  setWhere({ lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` })
                }
              />
              <p className="mt-2 text-xs text-muted">
                Map tiles come from openstreetmap.org only while this map is open.
              </p>
            </div>
          )}

          <h3 className="kicker mt-7">Or a demo preset (works offline)</h3>
          <div
            className="mt-3 grid gap-3 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Demo presets"
          >
            {PRESETS.map((p) => {
              const on = where?.presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-preset={p.id}
                  onClick={() =>
                    setWhere({
                      lat: p.lat,
                      lon: p.lon,
                      label: `${p.name}, ${p.city}`,
                      presetId: p.id,
                    })
                  }
                  className={`group relative rounded-2xl border-2 border-ink p-4 text-left transition-all ${on ? "translate-y-[3px] bg-ink text-paper shadow-none" : "bg-card shadow-[0_4px_0_var(--color-ink)] hover:-translate-y-0.5"}`}
                >
                  <Icon3D
                    name={p.icon as Icon3DName}
                    size={40}
                    className="transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110"
                  />
                  <div className="display mt-2 text-lg leading-tight">{p.name}</div>
                  <div className="mono text-xs opacity-70">{p.city}</div>
                  <div className="mt-1 text-xs opacity-80">{p.blurb}</div>
                </button>
              );
            })}
          </div>
          {where && (
            <p className="mono mt-4 text-sm" aria-live="polite">
              ★ Starting at <strong>{where.label}</strong>
              {demo && !where.presetId && (
                <span className="text-muted"> (demo mode uses the nearest preset&rsquo;s map)</span>
              )}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section className="card p-5 sm:p-6" aria-labelledby="long">
            <h2 id="long" className="display flex items-center gap-2 text-2xl">
              <Icon3D name="stopwatch" size={32} /> How long
            </h2>
            <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Walk length">
              {([10, 20, 40] as Duration[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={duration === d}
                  className="chip flex-1 justify-center !px-3"
                  onClick={() => setDuration(d)}
                >
                  {d} min
                </button>
              ))}
            </div>
            <p className="mono mt-2 text-xs text-muted">
              about {RADIUS_BY_DURATION[duration]} m around you
            </p>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="who">
            <h2 id="who" className="display flex items-center gap-2 text-2xl">
              <Icon3D name="friends" size={32} /> Who
            </h2>
            <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Who's coming">
              {WHO.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={who === w.id}
                  className="chip"
                  onClick={() => setWho(w.id)}
                >
                  <Icon3D name={w.icon} size={24} /> {w.label}
                </button>
              ))}
            </div>
            <label htmlFor="name" className="kicker mt-6 block">
              Walker name (optional, printed on the cover)
            </label>
            <input
              id="name"
              className="field mt-2"
              maxLength={40}
              placeholder="e.g. Asha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
            />
          </section>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="btn btn-primary btn-xl"
          disabled={!where || !!busy}
          onClick={fold}
          data-testid="fold"
        >
          <Icon3D name="printer" size={30} /> Fold my trail
        </button>
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {busy ??
            (where
              ? "Gemma will write it on your machine."
              : "Choose where you're starting first.")}
        </p>
      </div>
      {error && (
        <p
          className="mt-4 rounded-xl border-2 border-pink bg-[#ffe9ef] px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
