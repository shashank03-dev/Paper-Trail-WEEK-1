import { NextResponse } from "next/server";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { cached } from "@/lib/server/cache";
import { jsonError, parseBody, route } from "@/lib/server/http";
import { PRESETS } from "@/lib/presets";
import { photonSuggestions, type PhotonFeature } from "@/lib/places/photon";

export const dynamic = "force-dynamic";

const Body = z.object({
  q: z.string().trim().min(2).max(120),
  /** "suggest": as-you-type suggestions (Photon); "search": a full search (Nominatim). */
  mode: z.enum(["suggest", "search"]).default("search"),
});

// Nominatim's usage policy: at most 1 request per second, with a real User-Agent.
let chain: Promise<unknown> = Promise.resolve();
let last = 0;
function politely<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = 1000 - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export const POST = route("geocode", async (req, rc) => {
  const b = await parseBody(req, Body);
  if (!b.ok) return b.res;
  const s = serverConfig();
  const suggest = b.data.mode === "suggest";
  rc.note({ source: s.demoMode ? "presets" : suggest ? "photon" : "nominatim" });
  if (s.demoMode) {
    const q = b.data.q.toLowerCase();
    const hits = PRESETS.filter((p) => `${p.name} ${p.city}`.toLowerCase().includes(q));
    return NextResponse.json({
      results: (hits.length ? hits : PRESETS).map((p) => ({
        label: `${p.name}, ${p.city}`,
        lat: p.lat,
        lon: p.lon,
        presetId: p.id,
      })),
    });
  }
  const lang = (req.headers.get("accept-language") ?? "en").slice(0, 2).toLowerCase();
  if (suggest) {
    try {
      const results = await cached(
        "suggest",
        `${lang}:${b.data.q.toLowerCase()}`,
        async () => {
          const u = new URL(s.photonUrl);
          u.search = new URLSearchParams({
            q: b.data.q,
            limit: "8",
            // Photon speaks a handful of languages; others get local names.
            ...(["en", "de", "fr", "it"].includes(lang) ? { lang } : {}),
          }).toString();
          const res = await fetch(u, {
            headers: { "user-agent": `PaperTrail/1.0 (+${s.repoUrl})` },
            signal: AbortSignal.any([AbortSignal.timeout(6000), rc.signal]),
          });
          if (!res.ok) throw new Error(`photon ${res.status}`);
          return photonSuggestions((await res.json()) as { features?: PhotonFeature[] });
        },
        7 * 24 * 60 * 60 * 1000,
      );
      return NextResponse.json({ results });
    } catch (e) {
      if (rc.signal.aborted) throw e;
      // Suggestions are a convenience: the full search still works.
      rc.note({ error: (e as Error).message.slice(0, 200) });
      return NextResponse.json({ results: [], unavailable: true });
    }
  }
  try {
    const results = await cached("geocode", b.data.q.toLowerCase(), () =>
      politely(async () => {
        const u = new URL("https://nominatim.openstreetmap.org/search");
        u.search = new URLSearchParams({
          q: b.data.q,
          format: "jsonv2",
          limit: "5",
          addressdetails: "0",
        }).toString();
        const res = await fetch(u, {
          headers: {
            "user-agent": `PaperTrail/1.0 (+${s.repoUrl}; ${s.nominatimEmail || "no-email-set"})`,
            "accept-language": req.headers.get("accept-language") ?? "en",
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`nominatim ${res.status}`);
        const j = (await res.json()) as { display_name: string; lat: string; lon: string }[];
        return j.map((r) => ({
          label: r.display_name.split(",").slice(0, 3).join(","),
          lat: Number(r.lat),
          lon: Number(r.lon),
        }));
      }),
    );
    return NextResponse.json({ results });
  } catch (e) {
    return jsonError(
      502,
      `Search is unavailable (${(e as Error).message}). Use your location, the map, or a preset.`,
    );
  }
});
