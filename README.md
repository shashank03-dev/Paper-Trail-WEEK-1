# Paper Trail

**Every touch-grass app wants to come with you. This one stays home.**

Paper Trail turns your real neighbourhood into a one-sheet, 8-page paper zine written by an open model (Gemma 4, running on your machine), so your phone can stay home. When you get back, Gemma reads your pencil ticks, handwriting and sketches from one photo and stamps your Trail Book.

![TODO: hero GIF — the sheet printing panel by panel, then folding](docs/media/hero.gif)

> An entry for the DEV Hacktoberfest Open-Source AI Challenge, Week 1: **Touch Grass**. MIT licensed.

---

## How it works

```
 Setup ─► OpenStreetMap features + streets ─► route.ts picks a 5–6 stop loop (no AI)
   │      Open-Meteo weather                         │
   │                                                 ▼
   │                       Gemma writer: plan  ─►  cover · route · listen · back
   │                       (JSON schema → zod → grounding check → retry → template)
   ▼                                                 │
 IndexedDB  ◄──── the trail ◄──── one SVG sheet, mm-exact, drawn with rough.js
                                                     │
                                print ─► one cut, fold ─► walk (phone at home)
                                                     │
 Field Report ◄─ combine ◄─ Gemma reader (4 focused panel crops) ◄─ split ◄─ warp ◄─ fiducials ◄─ one photo
      │              ▲
      │              └── OMR: ink darkness inside the known checkbox rectangles
      ▼
 Trail Book + Screen vs Outside
```

1. **Pick a place** (your location, a search, a click on a map, or one of 3 offline demo presets), a length (10/20/40 min) and who's coming (solo, kids, a dog, a friend).
2. **The server fetches** the real features around you from OpenStreetMap (benches, murals, fountains, notable trees, post boxes…) and the street geometry, plus the weather. A deterministic planner picks a loop.
3. **Gemma writes the zine** in two stages so the screen can "print" it panel by panel: a structured plan (title, I-Spy list grounded in real feature ids, a riddle whose answer is a real waypoint, a sketch prompt) and then the copy for each panel. Every response is schema-checked, grounding-checked and length-checked against the actual panel it must fit; failures retry with the exact error; repeated failures fall back to a template built from the same real features. **It never dead-ends.**
4. **Print, cut once, fold.** The preview is the print, 1:1, Letter or A4, colour or B&W. A fold guide and a [/fold-test](app/fold-test/page.tsx) page check the imposition.
5. **Walk.** The screen says *"Put your phone down. Go."* and doesn't tick.
6. **Come back, take one photo.** The browser finds the four printed corner markers, solves a homography, warps the photo flat, cuts it into panels and measures ink in every checkbox. Gemma gets **four small, focused crops** (I-Spy, Listen, Riddle, Sketch), each with what it should expect to see. Where Gemma and the tick-counter agree, it's high confidence; where they disagree, you get one tap to fix it.
7. **The Field Report:** your handwriting transcribed in a handwriting font, the riddle judged kindly, your sketch described ("a tree with three branches, like it's waving at you"), a note from *The Trail Office*, a rubber stamp, and the **Screen vs Outside** counter.

Every graphic on the sheet is drawn in code (SVG + rough.js): the map, the weather glyph, the stamp, the QR code. No stock images, no image generation, **zero external assets on paper**. The app chrome uses Microsoft's MIT-licensed Fluent 3D emoji, self-hosted.

## Quick start

### Local (the way it's meant to run)

```bash
# 1. The model
ollama pull gemma4:e4b        # and gemma4:e2b for smaller machines
ollama serve                  # if it isn't already running

# 2. The app
cp .env.example .env.local    # set NOMINATIM_EMAIL and DEVICE_LABEL
pnpm i
pnpm dev                      # http://localhost:3000
```

To scan the QR code on page 8 with a phone, set `PUBLIC_URL` to your machine's LAN address (e.g. `http://192.168.1.20:3000`).

**No model handy?** `DEMO_MODE=true pnpm dev` uses the cached presets and, if Ollama isn't reachable, replays recorded output. The UI shows a yellow **replay** badge so it's never mistaken for live inference.

### Docker

```bash
docker compose up            # web on :3000, Ollama on :11434 (first start pulls the model)
```

### Render (Render as the AI runtime)

`render.yaml` is a Blueprint with two services:

- **`papertrail-ollama`** — a private service built from `ollama/ollama`, a 20 GB persistent disk at `/root/.ollama`, and a start script that pulls `gemma4:e2b` on first boot, then serves (`OLLAMA_NUM_PARALLEL=1`, `OLLAMA_MAX_LOADED_MODELS=1`, `OLLAMA_KEEP_ALIVE=24h`). Use a plan with **≥ 8 GB RAM**.
- **`papertrail-web`** — the Next.js app with `LLM_BASE_URL=http://papertrail-ollama:11434/v1`.

On CPU it's slow: TODO: _measured tok/s on Render_. That's why the zine streams panel by panel instead of making you wait for the whole thing.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `LLM_BASE_URL` | `http://localhost:11434/v1` | Any OpenAI-compatible endpoint serving an **open** model |
| `LLM_API_KEY` | `ollama` | |
| `LLM_MODEL_TEXT` | `gemma4:e4b` | The writer |
| `LLM_MODEL_VISION` | `gemma4:e4b` | The reader |
| `LLM_TIMEOUT_MS` | `120000` | |
| `LLM_OLLAMA_NATIVE` | `false` | Use Ollama's `/api/chat` with `format: <schema>` instead of `/v1` |
| `NOMINATIM_EMAIL` | — | Required by the Nominatim usage policy |
| `OVERPASS_URL` | overpass-api.de | |
| `DEVICE_LABEL` | `my laptop` | Printed in the colophon |
| `DEMO_MODE` | `false` | Fixtures for places/weather; replay if the model is offline |
| `PUBLIC_URL` | request origin | Base of the QR code URL |
| `ALLOW_ENDPOINT_OVERRIDE` | `false` | Let the Settings page change the endpoint (keep off on public deploys) |

## Numbers

Two eval harnesses, both runnable by anyone with Ollama. **Real Gemma numbers are still to be filled in** (they need a GPU-ish machine; the build container had no model). Here's what is measured already, without a model:

- **Fiducial detection: 30/30** synthetic phone photos (tilt, rotation ±8°, shadow, blur, JPEG noise).
- **OMR alone: 100% tick accuracy** on the same 30 photos. Synthetic photos are kinder than a real crumpled sheet, so treat that as a ceiling, not a promise.

### Reader (`pnpm eval:reader`)

TODO: paste `evals/results/reader.md` after running against Gemma. It compares `gemma4:e2b` vs `gemma4:e4b` × whole-sheet vs per-panel vs per-panel+OMR on tick accuracy, handwriting CER, riddle-verdict accuracy and seconds per sheet.

### Writer (`pnpm eval:writer`)

TODO: paste `evals/results/writer.md`. 36 trails per model: schema-valid on the first try, grounding rate, hallucinated places after validation (should be 0), fits-panel rate, latency.

To run them:

```bash
pnpm fixtures:photos --n 30 --out evals/out/sheets
EVAL_MODELS=gemma4:e2b,gemma4:e4b pnpm eval:reader
EVAL_MODELS=gemma4:e2b,gemma4:e4b pnpm eval:writer
```

The committed `evals/results/*.md` were produced against the mock model and say so at the top.

## Why open models

- **My home location and my handwriting never leave my machine.** The model runs in Ollama next to the app. There are no accounts and no analytics; your trails live in your browser's IndexedDB.
- **It works offline after printing.** It's paper.
- **Swap the model with one env var.** `gemma4:e2b` ↔ `gemma4:e4b` and measure the trade-off with the evals.
- **Apache-2.0 weights** mean a school, library or scout group can run it for free, on their own hardware.
- A closed API would have meant sending a map of my neighbourhood and a photo of my notes to someone else's server for every walk.

## Development

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

- **Unit (Vitest, 69 tests):** imposition, panel rotation, homography + warp on a synthetic image, fiducial detection and OMR on synthetic phone photos, route selection, Overpass normalisation, `fitText`, schemas, grounding, the retry and fallback loop (with a fake model that returns broken JSON and hallucinated ids first), riddle judging, scoring.
- **E2E (Playwright, 8 tests):** a production build against `scripts/mock-llm.ts`. Setup → generate → 8 panels → a visual snapshot of the flat sheet; the return flow with a synthetic photo → auto corners → Field Report → stamp → Trail Book; a trail from another device; settings → test connection; axe on landing, setup, preview, report and the Trail Book (no serious violations).
- `pnpm mock:llm` runs the mock model (it is not a model; it answers schema-valid JSON from the prompt so the whole app can be exercised without a GPU).

Useful scripts: `pnpm fixtures:fetch` (replace the hand-traced presets with live OSM), `pnpm fixtures:record` (record real Gemma output for demo replay), `pnpm fixtures:photos` (synthetic filled-in sheets), `pnpm fonts:metrics` (regenerate text metrics from the font files).

Code map: `lib/zine/` (layout, imposition, text metrics, the SVG sheet), `lib/writer/` + `lib/prompts/` (Gemma writer, grounding, fallbacks), `lib/vision/` (fiducials, homography, warp, OMR), `lib/reader/` (per-panel reading, combining, score), `app/api/*` (zod-validated route handlers). See [docs/design.md](docs/design.md) and [DECISIONS.md](DECISIONS.md).

## Limitations (honestly)

- **OSM coverage varies.** In thinly mapped places the I-Spy list leans on ambient items ("a leaf that's two colours") and the route on whatever is mapped.
- **The demo presets are hand-traced.** Feature names are real places, but positions and streets in `fixtures/places` are approximations drawn by hand because the build environment couldn't reach OpenStreetMap. Run `pnpm fixtures:fetch` to replace them with real data.
- **The demo replays are placeholders** recorded from the mock model until you run `pnpm fixtures:record` against Gemma. They're labelled as such.
- **Bad light hurts reading.** Harsh shadows across a checkbox or a very low angle can fool both OMR and the model; that's what the one-tap fix is for.
- **CPU inference is slow**, especially on Render. E2B is the right model there.
- Reading handwriting and judging sketches are things small models get wrong sometimes. The report always lets you correct it.

## Credits

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL), printed on page 2 of every zine.
- Weather by [Open-Meteo](https://open-meteo.com/). Geocoding by Nominatim.
- [rough.js](https://roughjs.com/) by Preet Shihn for every wobbly line.
- [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) 3D icons © Microsoft, MIT.
- Fonts: Fraunces, Inter, IBM Plex Mono, Caveat, Reenie Beanie, Nanum Pen Script (SIL OFL), self-hosted.
- Inspired by the **I-Spy** spotter books (1948 onward), whose readers mailed in a finished book and got a reward back by post.
- Gemma 4 by Google DeepMind, served by [Ollama](https://ollama.com/).
