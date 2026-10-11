"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TrailTicket } from "@/components/TrailTicket";
import { PlaceSearch } from "@/components/PlaceSearch";
import { nearHint, type Near } from "@/lib/client/near";
import {
  ArrowRight,
  Baby,
  Dog,
  Loader2,
  LocateFixed,
  Map as MapIcon,
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
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-bone-2" />,
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
  const [showMap, setShowMap] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    void getConfig().then((c) => setDemo(c.demoMode));
  }, []);
  // Where search should look first, found without asking (see nearHint).
  const [hint, setHint] = useState<Near | null>(null);
  useEffect(() => {
    void nearHint().then(setHint);
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
    <div className="mx-auto max-w-7xl px-[var(--gutter)] pb-16 pt-32 sm:pt-40">
      <p className="label folio">New trail</p>
      <h1 className="display mt-6 text-[clamp(3rem,1.6rem+5vw,6.2rem)]">
        Where does your <em className="text-riso">walk begin?</em>
      </h1>
      <p className="lede mt-6 max-w-xl">
        Choose a starting point, a length and your company. We&rsquo;ll draw the map, plan a loop
        and write all eight pages.
      </p>

      <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_24rem] lg:gap-10">
        <div className="card divide-y divide-line">
          <Step n="01" id="where" title="Start point">
            <div className="flex flex-wrap gap-2.5">
              <button type="button" className="btn btn-sheet" onClick={locate}>
                <LocateFixed size={17} strokeWidth={1.6} /> Use my location
              </button>
              <button
                type="button"
                className="btn btn-sheet"
                onClick={() => setShowMap((v) => !v)}
                aria-expanded={showMap}
              >
                <MapIcon size={17} strokeWidth={1.6} /> {showMap ? "Hide map" : "Pick on a map"}
              </button>
            </div>
            <PlaceSearch
              onPick={setWhere}
              onError={setError}
              near={where ? { lat: where.lat, lon: where.lon, precise: true } : hint}
            />
            {showMap && (
              <div className="mt-4">
                <LocationPicker
                  lat={where?.lat ?? 51.5072}
                  lon={where?.lon ?? -0.1276}
                  onPick={(lat, lon) =>
                    setWhere({ lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` })
                  }
                />
                <p className="mt-2 text-xs text-ink-3">
                  Map tiles load from openstreetmap.org only while this map is open.
                </p>
              </div>
            )}

            <p className="label mt-10">Or start from an example park</p>
            <div
              className="mt-4 grid gap-3 sm:grid-cols-3"
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
                    className={`group relative overflow-hidden rounded-[18px] p-5 text-left transition-[background,box-shadow,transform] duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 ${on ? "bg-ink text-sheet shadow-[0_18px_34px_-18px_rgb(21_20_18/0.7)]" : "bg-bone/60 shadow-[inset_0_0_0_1px_var(--color-line-2)] hover:bg-bone"}`}
                  >
                    <span
                      className={`mono text-[0.7rem] uppercase tracking-[0.08em] ${on ? "text-sheet/70" : "text-ink-3"}`}
                    >
                      {p.city}
                    </span>
                    <span className="title mt-2 block text-[1.55rem]">{p.name}</span>
                    <span
                      className={`mt-2 block text-[0.88rem] leading-snug ${on ? "text-sheet/75" : "text-ink-2"}`}
                    >
                      {p.blurb}
                    </span>
                    <span
                      aria-hidden
                      className={`absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full transition-all duration-500 ${on ? "scale-100 bg-riso" : "scale-75 shadow-[inset_0_0_0_1.5px_var(--color-line-2)]"}`}
                    >
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n="02" id="long" title="How long">
            <div
              className="segmented !grid w-full grid-cols-3"
              role="radiogroup"
              aria-label="Walk length"
            >
              {([10, 20, 40] as Duration[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={duration === d}
                  className="chip !h-16 flex-col !gap-0"
                  onClick={() => setDuration(d)}
                >
                  <span className="font-serif text-[1.7rem] leading-none">{d}</span>
                  <span className="mono text-[0.66rem] uppercase tracking-[0.08em] text-ink-3">
                    minutes
                  </span>
                </button>
              ))}
            </div>
            <p className="mono mt-4 text-[0.78rem] text-ink-3">
              Looks for places within about {RADIUS_BY_DURATION[duration]} m of your start.
            </p>
          </Step>

          <Step n="03" id="who" title="Who’s coming">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who's coming">
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
            <label htmlFor="name" className="label mt-10 block">
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
          </Step>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <TrailTicket
            where={where?.label ?? null}
            duration={duration}
            company={whoLabel}
            name={name.trim()}
          >
            <button
              type="button"
              className="btn btn-riso btn-lg w-full"
              disabled={!where || !!busy}
              onClick={fold}
              data-testid="fold"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : null}
              {busy ? "Working…" : "Fold my trail"}
              {!busy && (
                <span className="knob" aria-hidden>
                  <ArrowRight size={18} />
                </span>
              )}
            </button>
            <p
              className="mt-3 text-center text-[0.82rem] text-ink-3"
              role="status"
              aria-live="polite"
            >
              {busy ?? (where ? "Takes about a minute." : "Choose a start point first.")}
            </p>
            {demo && where && !where.presetId && (
              <p className="mt-2 text-center text-[0.8rem] text-ink-3">
                Demo mode uses the nearest example park&rsquo;s map.
              </p>
            )}
          </TrailTicket>
          {error && (
            <p className="notice notice-error mt-4" role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Step({
  n,
  id,
  title,
  children,
}: {
  n: string;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-6 sm:p-9" aria-labelledby={id}>
      <div className="mb-7 flex items-baseline gap-4">
        <span className="mono text-[0.78rem] text-riso">{n}</span>
        <h2 id={id} className="title text-[2rem]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
