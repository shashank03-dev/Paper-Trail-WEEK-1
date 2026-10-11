# Paper Trail — design notes

This is the brainstorm and system design written before the build. The
product brief and the build prompt are the source of truth for *what*; this
file is the *how*, and the record of options we weighed and dropped.
`DECISIONS.md` keeps the short list of final calls.

## 1. The shape of the thing

```
 Setup ──► OSM features + ways ──► route.ts (deterministic loop) ──┐
   │        Open-Meteo weather                                     │
   │                                                               ▼
   │                                            Gemma writer: plan (1 call, JSON schema)
   │                                            Gemma writer: cover / route / listen / back
   │                                                               │
   ▼                                                               ▼
 IndexedDB (Dexie) ◄──────────── the trail record ◄──── SVG zine (mm-exact, rough.js)
                                                                   │
                                                          print ──► paper ──► walk
                                                                   │
 Field Report ◄── combine ◄── Gemma reader (4 focused panel calls) ◄── panels ◄── warp ◄── fiducials ◄── one photo
       │              ▲
       │              └── OMR (ink darkness inside known checkbox rects)
       ▼
   Trail Book (+ Screen vs Outside)
```

The server is **stateless**. It proxies OSM / weather / geocoding (so we can
cache and send a proper User-Agent) and talks to Gemma. Everything the walker
owns — the trail, the plan, the report, screen-time sessions — lives in their
browser's IndexedDB. That is the privacy story in one sentence: *the only
place your street and your handwriting go is the model endpoint you chose.*

## 2. Brainstorm: the big forks

### 2.1 How to draw the sheet

| Option | For | Against | Verdict |
| --- | --- | --- | --- |
| HTML/CSS panels | Text wraps for free | Print vs screen drift; can't rasterise reliably for PDF; OMR needs exact box positions | ✗ |
| Canvas | Pixel control | Not crisp in print, a11y poor | ✗ |
| **One SVG in mm units** | 1:1 print, crisp, rasterisable for PDF and synthetic photos, every coordinate known to the reader | We must wrap text ourselves | ✓ |

Text wrapping without the DOM needs font metrics. We generate advance-width
tables from the actual font files at build time (`scripts/gen-font-metrics.ts`
→ `lib/zine/metrics.generated.ts`). So `fitText` gives *identical* line breaks
in the browser, in Node (server-side "does it fit?" checks, evals), and in the
synthetic-sheet renderer. Determinism beats a canvas measurer that changes
with font-loading timing.

### 2.2 Where the fiducials go

Four 8 mm QR-finder-style squares sit at the corners of the 6 mm print margin.
With the standard one-cut imposition (top row 5·4·3·2 rotated 180°, bottom row
6·7·8·1 upright), every sheet corner lands in the **panel-local bottom corner**
of pages 1, 2, 5 and 6. So every panel reserves a 12 mm footer band whose
corners stay empty; page numbers sit in the middle of it. One rule, no special
cases.

### 2.3 How to read the photo

1. Fiducials → 4-point homography (hand-written DLT solve) → inverse-mapped
   bilinear warp to an exact 6 px/mm sheet raster.
2. Split by the known grid, rotate the top row 180°, contrast-stretch.
3. Send **only pages 4–7**, each with its own focused prompt and what we
   expect to see there (item labels in order, the riddle, the sketch prompt).
4. OMR as a second opinion for ticks: the checkbox rectangles come from
   `layout.ts`, so we measure ink inside each one. Agree → high confidence.
   Disagree → "unsure", ask for a tap.

No OpenCV: adaptive threshold + connected components is ~150 lines and
unit-testable on synthetic images.

### 2.4 Generation that never dead-ends

`chatJSON()` = JSON-schema `response_format` → `JSON.parse` → zod → grounding
validator → retry with the exact error (≤ 2 retries) → deterministic template
that still uses the real features. Every call logs which path it took
(`llm`, `llm-retry`, `replay`, `fallback`) and the UI is honest about it.

Two stages so the screen can "print" panel by panel:

- **Stage 1 — plan** (temperature 0.2 for structure): title, vibe, I-Spy
  items (≥ 6 grounded in feature ids), riddle (target must be a waypoint),
  sketch prompt, listen stop. Streams tokens so we can show `tok/s`.
- **Stage 2 — copy** (temperature 0.8): cover, route directions, listen
  intro, back-cover blurb. Each has a character budget derived from its panel
  and is re-checked with `fitText`; overflow → one "shorter please" retry →
  ellipsis.

### 2.5 Route selection is not AI

`lib/route.ts` picks 5–6 waypoints that form a loop inside the time budget
(4.5 km/h, straight line × 1.3 street factor), prefers named and interesting
kinds, orders them nearest-neighbour then 2-opt. Gemma gets the result. The
model writes; it does not navigate.

### 2.6 The look: "3D paper on a riso desk"

The brief says *the paper is always the hero* and *risograph zine*. The ask
for this build added *3D-ish and very pretty*. We reconcile both:

- The app is a desk: cream paper (`#F4EFE4`), SVG grain, soft long shadows.
- **The paper is a real 3D object** in CSS 3D (`preserve-3d`, perspective):
  the landing hero folds an 8-panel sheet into a booklet and back; the preview
  tilts toward the cursor; the folded booklet turns pages in 3D; the Trail
  Book is a shelf of tilted mini-zines; the stamp slams down on the Z axis.
- **3D icons** in the UI chrome: Microsoft's Fluent Emoji 3D set (MIT),
  self-hosted in `public/icons/3d`, animated with CSS (bob, sway, parallax
  depth). They never appear on the printed sheet — the zine stays
  "zero external assets, all drawn in code".
- Riso details: fluoro pink `#FF5C8A` + teal `#1F8A8A` spot colours with
  a slight mis-registration offset on big headings, chunky offset-shadow
  buttons that press down in Z.
- Considered and dropped: three.js / react-three-fiber. A WebGL paper fold is
  gorgeous but ~150 kB, needs a texture of the sheet (which we'd have to
  rasterise anyway), and fights `prefers-reduced-motion` and print. CSS 3D
  gets 90 % of the feeling at 0 kB and keeps the sheet as live, crisp SVG.
  (Superseded for the landing hero: see DECISIONS 31, 36 and 39.)

#### Hero rendering: every device gets the fold

```
            scroll ──► anime.js timeline ──► Rig (folds, pose, pencil)
                                               │
                         ┌─────────────────────┼──────────────────────┐
                         ▼                     ▼                      ▼
                 three.js scene         Canvas 2D fold          printed sheet
                 high / low detail      (liteFold.ts)           (last resort)
                         │   throws, context lost,  ▲  throws         ▲
                         └── median < 22 fps ───────┘ ────────────────┘
```

`deviceTier()` picks the starting renderer: WebGL for most devices (lower
detail on few cores / little memory), Canvas 2D for Data Saver, 2G or no
WebGL2. Both read the same `Rig` and the same fold geometry, so the
choreography, captions and phone layout are identical whichever one draws.

Fonts are **self-hosted** (Fraunces, Inter, IBM Plex Mono, Caveat, all OFL)
instead of loaded from Google Fonts at runtime: no third-party request when
you open the app is part of the privacy promise.

### 2.7 Demo mode

`DEMO_MODE=true` → places and weather from `fixtures/places/*.json`; if the
LLM is unreachable, the writer replays `fixtures/llm/<preset>/*.json` and the
UI shows a "replay" badge. This keeps the video and offline judging smooth
without pretending.

## 3. Data model (IndexedDB `papertrail`)

```ts
trails:   { id, createdAt, printedAt?, returnedAt?, location, durationMin,
            companions, walkerName, paper, color, plan?, panels, route,
            features, ways, weather, model, genPath, presetId?,
            outsideMs?, report?, score?, stamp?, inBook }
sessions: { ++id, trailId, phase, startedAt, ms }   // visibility-based
```

Screen time = Σ `sessions.ms` for the trail. Outside = return-photo time −
`printedAt`, capped at 3 h.

## 4. API surface

| Route | In | Out |
| --- | --- | --- |
| `GET /api/health` | — | `{ ok, model, latencyMs, tokensPerSec, mode }` |
| `GET /api/config` | — | public URL, device label, model names, demo flag |
| `POST /api/places` | `{lat, lon, radiusM, presetId?}` | `{ features, ways }` |
| `POST /api/weather` | `{lat, lon, presetId?}` | weather summary |
| `POST /api/geocode` | `{q}` | Nominatim results (1 req/s) |
| `POST /api/trail/plan` | writer context | SSE: `tokens`, `status`, `plan` |
| `POST /api/trail/panel` | `{panel, plan, context}` | one panel's copy |
| `POST /api/read` | `{panelImages, expected, omr, mode}` | `FieldReport` |

All inputs zod-validated; `/api/*` behind an in-memory token bucket; uploads
capped at 8 MB.

## 5. Testing strategy

- **Unit (Vitest):** imposition, rotation, homography + warp (synthetic),
  fiducial detection, OMR, route, Overpass normalisation, fitText, schemas,
  grounding, retry/fallback with a fake LLM that returns broken JSON first,
  score.
- **E2E (Playwright + a mock OpenAI-compatible server):** generate → preview
  → visual snapshot of the flat sheet; return flow with a synthetic photo →
  auto corners → Field Report → stamp → Trail Book; settings test
  connection; axe on landing / preview / report.
- **Evals (real Gemma, human-run):** writer (schema-valid first try,
  grounding, hallucinated places, fits-panel, latency) and reader (E2B vs E4B
  × whole-sheet / per-panel / per-panel + OMR) over synthetic photographed
  sheets with ground truth.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Gemma misreads ticks in a bad photo | fiducials + warp + per-panel crops + OMR second opinion + one-tap fix |
| OSM is thin somewhere | ambient I-Spy items, deterministic fallback, presets |
| Text overflows a panel | metrics-based `fitText`, char budgets in schemas, shorter retry, ellipsis |
| CPU inference is slow (Render) | stream panel by panel, show tok/s honestly, use E2B there |
| Wrong fold order | `/fold-test` page + one mapping table + unit test |
