"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Baby,
  Dog,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
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
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-white/5" />,
});

type Where = { lat: number; lon: number; label: string; presetId?: string };

const WHO: { id: Companions; label: string; icon: LucideIcon }[] = [
  { id: "solo", label: "Just me", icon: User },
  { id: "kids", label: "With kids", icon: Baby },
  { id: "dog", label: "With a dog", icon: Dog },
  { id: "friend", label: "With a friend", icon: Users },
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

  const whoLabel = WHO.find((w) => w.id === who)!.label;
  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-32 sm:px-8 sm:pt-36">
      <p className="eyebrow">New trail</p>
      <h1 className="display mt-4 text-[clamp(2.6rem,1.6rem+3.6vw,4.6rem)]">
        Where does your <em className="text-grass">walk</em> start?
      </h1>
      <p className="lede mt-4 max-w-xl">
        Pick a place, a length and who&rsquo;s coming. We&rsquo;ll draw the map, plan a loop and
        write the booklet.
      </p>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="panel divide-y divide-line">
          <section className="p-6 sm:p-8" aria-labelledby="where">
            <div className="flex items-baseline gap-3">
              <span className="mono text-xs text-grass">01</span>
              <h2 id="where" className="h3 text-2xl">
                Start point
              </h2>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button type="button" className="btn" onClick={locate}>
                <LocateFixed size={17} strokeWidth={1.6} /> Use my location
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowMap((v) => !v)}
                aria-expanded={showMap}
              >
                <MapIcon size={17} strokeWidth={1.6} /> {showMap ? "Hide map" : "Pick on a map"}
              </button>
            </div>
            <form onSubmit={search} className="relative mt-3" role="search">
              <label htmlFor="q" className="sr-only">
                Search for a street or place
              </label>
              <Search
                size={17}
                strokeWidth={1.6}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-3"
              />
              <input
                id="q"
                className="field !pl-11 !pr-24"
                placeholder="Search a street, park or neighbourhood"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                className="btn btn-sm absolute right-1.5 top-1/2 -translate-y-1/2"
                type="submit"
              >
                Search
              </button>
            </form>
            {results && results.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-2xl bg-raise shadow-[inset_0_0_0_1px_var(--color-line-2)]">
                {results.map((r) => (
                  <li key={`${r.lat},${r.lon}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-fg-2 hover:bg-white/5 hover:text-fg"
                      onClick={() => (setWhere(r), setResults(null))}
                    >
                      <MapPin size={15} strokeWidth={1.6} className="shrink-0 text-fg-3" />{" "}
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
                <p className="mt-2 text-xs text-fg-3">
                  Map tiles load from openstreetmap.org only while this map is open.
                </p>
              </div>
            )}

            <p className="eyebrow mt-9">Or try an example place</p>
            <div
              className="mt-3 grid gap-2.5 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Example places"
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
                    className={`group rounded-2xl p-4 text-left transition-all duration-300 ${on ? "bg-fg text-bg" : "bg-white/[0.03] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-white/[0.06]"}`}
                  >
                    <span
                      className={`mono text-[0.68rem] uppercase tracking-[0.14em] ${on ? "text-bg/60" : "text-fg-3"}`}
                    >
                      {p.city}
                    </span>
                    <span className="h3 mt-1 block text-lg">{p.name}</span>
                    <span
                      className={`mt-1 block text-[0.82rem] leading-snug ${on ? "text-bg/70" : "text-fg-2"}`}
                    >
                      {p.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="p-6 sm:p-8" aria-labelledby="long">
            <div className="flex items-baseline gap-3">
              <span className="mono text-xs text-grass">02</span>
              <h2 id="long" className="h3 text-2xl">
                How long
              </h2>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Walk length">
              {([10, 20, 40] as Duration[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={duration === d}
                  className="chip !h-14 justify-center !text-base"
                  onClick={() => setDuration(d)}
                >
                  {d} min
                </button>
              ))}
            </div>
            <p className="mono mt-3 text-xs text-fg-3">
              Looks about {RADIUS_BY_DURATION[duration]} m around your start.
            </p>
          </section>

          <section className="p-6 sm:p-8" aria-labelledby="who">
            <div className="flex items-baseline gap-3">
              <span className="mono text-xs text-grass">03</span>
              <h2 id="who" className="h3 text-2xl">
                Who&rsquo;s coming
              </h2>
            </div>
            <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Who's coming">
              {WHO.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={who === id}
                  className="chip"
                  onClick={() => setWho(id)}
                >
                  <Icon size={16} strokeWidth={1.6} /> {label}
                </button>
              ))}
            </div>
            <label htmlFor="name" className="eyebrow mt-8 block">
              Name on the cover (optional)
            </label>
            <input
              id="name"
              className="field mt-3 max-w-sm"
              maxLength={40}
              placeholder="e.g. Asha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="panel p-6">
            <p className="eyebrow">Your trail</p>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="col-span-2">
                <dt className="text-fg-3">Starting at</dt>
                <dd className="mt-0.5 text-base text-fg" aria-live="polite">
                  {where ? where.label : <span className="text-fg-3">Not chosen yet</span>}
                </dd>
              </div>
              <div>
                <dt className="text-fg-3">Length</dt>
                <dd className="mt-0.5 text-base text-fg">{duration} min</dd>
              </div>
              <div>
                <dt className="text-fg-3">Company</dt>
                <dd className="mt-0.5 text-base text-fg">{whoLabel}</dd>
              </div>
            </dl>
            <div className="hairline my-6" />
            <button
              type="button"
              className="btn btn-primary btn-lg w-full"
              disabled={!where || !!busy}
              onClick={fold}
              data-testid="fold"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : null}
              {busy ? "Working…" : "Fold my trail"}
              {!busy && <ArrowRight size={18} className="arrow" />}
            </button>
            <p className="mt-3 text-center text-xs text-fg-3" role="status" aria-live="polite">
              {busy ?? (where ? "Takes about a minute." : "Choose a start point first.")}
            </p>
            {demo && where && !where.presetId && (
              <p className="mt-3 text-xs text-fg-3">
                Demo mode uses the nearest example place&rsquo;s map.
              </p>
            )}
          </div>
          {error && (
            <p
              className="mt-4 rounded-2xl bg-ember/10 px-4 py-3 text-sm text-ember shadow-[inset_0_0_0_1px_rgb(255_138_107/0.3)]"
              role="alert"
            >
              {error}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
