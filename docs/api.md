# Paper Trail — API system design

How every request from the browser is handled: what each endpoint takes and
returns, where it calls out, how long it may take, and what happens when
something upstream fails. The short version: **the server is stateless, every
input is validated, every model call is bounded and observable, and no path
dead-ends** — when the model can't answer, a deterministic template built from
the same real map data does.

## 1. Architecture

```
 Browser (IndexedDB: trails, reports, screen-time)
   │  fetch / SSE, JSON only, x-request-id on every response
   ▼
 middleware.ts ── request ID ── per-IP token bucket (429 + Retry-After)
   │
   ▼
 route(name, handler)            lib/server/http.ts
   │  zod body validation (400), 8 MB cap (413), error boundary (500),
   │  one JSON log line per request, abort signal from the client
   │
   ├── /api/places   ──► cache (single-flight, 24 h) ──► Overpass mirrors, failover (45 s) → stale cache
   ├── /api/weather  ──► cache (single-flight, 30 min) ─► Open-Meteo (10 s)  → mild default on failure
   ├── /api/geocode  ──► cache ──► 1 req/s queue ──► Nominatim (10 s); mode=suggest ──► Photon (6 s)
   ├── /api/config   ──► public config only (never keys)
   ├── /api/health   ──► cached ping (60 s, single-flight)
   └── /api/trail/plan · /api/trail/panel · /api/read
          │
          ▼
        chatFor()                lib/server/chat.ts
          │  gate: ≤ LLM_MAX_CONCURRENCY calls at once, FIFO queue,
          │        BusyError → 503 after LLM_QUEUE_TIMEOUT_MS
          │  cancellation: client disconnect aborts the model call
          ▼
        createChat()             lib/llm/client.ts
          │  provider chain (LLM_PROVIDER=gemini,ollama-cloud)
          │  circuit breaker per provider (lib/llm/breaker.ts)
          │  capability adaptation (system role, JSON schema, reasoning effort)
          ▼
        Gemma 4 — Gemini API · Ollama Cloud · local Ollama
          │
          ▼
        chatJSON()               lib/llm/json.ts
             JSON → zod → grounding + fit checks → retry with the exact problems (≤ 2)
             → LlmJsonError → deterministic template (lib/writer/fallback.ts)
```

The server keeps **no user data**. Trails, photos-derived reports and screen
time live in the browser's IndexedDB; the server only sees what a single
request needs, and logs none of it (see §6).

## 2. Conventions

| | |
| --- | --- |
| Transport | JSON over HTTPS. Long model work streams as `text/event-stream` (SSE). |
| Validation | Every body is parsed with zod; unknown/invalid input is a `400` listing the first 8 issues. |
| Size | Bodies over 8 MB are refused with `413` before parsing. |
| Errors | One shape everywhere: `{ "error": "<human sentence>", "code": "<machine code>", "details"?: [...] }`. The UI shows `error` as is. |
| Codes | `invalid_request` 400 · `forbidden` 403 · `not_found` 404 · `too_large` 413 · `rate_limited` 429 · `upstream_unavailable` 502 · `busy` 503 · `internal` 500 |
| Request ID | `x-request-id` on every response (taken from the request if it's a sane token, otherwise generated). 500s quote it. |
| Origin | `/api/*` serves this site's own pages. A browser request marked `Sec-Fetch-Site: cross-site` (another site's scripts) is refused with `403 forbidden` before it reaches rate limiting or the model. |
| Internal errors | A 500 or a mid-stream `internal` error says only "Something went wrong on our side (request <id>)"; the real message goes to the log line as `err`. Provider errors are never echoed to the browser. |
| Retry hints | `429` and `503` carry `Retry-After` (seconds). |
| Streams | SSE events are `data: {"type": ...}` lines. A `: ping` comment every 15 s keeps proxies from closing long generations. A failure mid-stream is an `{"type":"error","error","code"}` event, never a dropped connection. |
| Per-browser model choice | `x-pt-model-text` / `x-pt-model-vision` headers (validated) pick a different Gemma size; `x-pt-llm-base` is honoured only with `ALLOW_ENDPOINT_OVERRIDE=true`. |

## 3. Endpoints

### `GET /api/config`
Public configuration for the UI: model names, where the model runs
(`endpointLabel`, `hosted`), provider chain labels, `publicUrl`, `demoMode`.
Never includes keys or (unless overrides are allowed) the endpoint URL. Cheap;
it is also Render's health check.

### `GET /api/health[?fresh=1]`
Is the model answering? `{ ok, model, where, latencyMs, tokensPerSec, mode, cached, gate }`.
- Pings with an 8-token prompt. Results are **cached for 60 s** per provider
  chain + model, and concurrent callers share one in-flight ping, so the model
  badge on every page costs one model call per minute, not one per visitor.
- `?fresh=1` (Settings → Test connection) always pings.
- `503` when the model is down (`200` with `mode: "replay"` in demo mode).
- `gate` reports `{ active, queued, limit, budget: { used, limit } }` for the model gate and today's call budget.
- A failed ping reports `HTTP <status>`, `timed out` or `unreachable`, never the provider's own error text.

### `POST /api/places`
`{ lat, lon, radiusM: 100–1500, presetId? }` → `{ features[], ways[], source }`.
Overpass query for nameable, walkable features and street geometry, normalised
in `lib/places/overpass.ts`. Cached 24 h by rounded coordinates + radius, with
single-flight. A preset (or demo mode) serves the fixture instead, re-measured
from the actual start point. Servers are tried in order within a 45 s budget
(`lib/places/fetchOverpass.ts`): `OVERPASS_URL` first, then public mirrors;
a failure moves on at once, and a server still silent after 5 s gets the
next one asked alongside it (first good answer wins, the other is cancelled
without penalty); the last one that answered goes first next time, a failing one waits 5 min at
the back, and each attempt's real error (`ECONNREFUSED`, `HTTP 429`, timeout)
is logged. (overpass-api.de refuses connections from the Render host.) If none
answers, a stale cached map of the same spot (up to 30 days) is served; only
then `502 upstream_unavailable` with `Retry-After: 30`.

### `POST /api/weather`
`{ lat, lon, presetId? }` → `{ tempC, condition, precipProbNext2h, windKph, sunset, isDaylight, source }`.
Open-Meteo, cached 30 min per ~1 km cell and hour. **Never fails**: on any
error it returns a mild default (`source: "default"`) — weather is a nicety and
must not block a trail.

### `POST /api/geocode`
`{ q: 2–120 chars, mode?: "search" | "suggest" }` → `{ results: [{ label, lat, lon }] }`.
`mode: "suggest"` is search-as-you-type for the setup page: Photon (komoot's
OSM geocoder, built for autocomplete, which Nominatim's policy forbids),
cached a week per language and query, and it never errors: a failure returns
`{ results: [], unavailable: true }` and the full search still works.
Nominatim, cached, and serialised through a 1-request-per-second queue with a
real User-Agent and contact email, as its usage policy requires. In demo mode
it searches the presets. Failure → `502` suggesting location, map or presets.

### `POST /api/trail/plan` — SSE
`{ context: WriterContext }` (route, features, weather, walker, time).
Stage 1 of writing: one structured Gemma call for the plan (title, I-Spy list
grounded in feature ids, a riddle whose answer is a waypoint, sketch prompt,
listen stop).

Events: `status` (model, where, live/replay) → `tokens` (every ≥ 250 ms:
tokens so far, tok/s) → `plan` (`plan`, `path`, `attempts`, `tps`, `ms`) or
`error`.

### `POST /api/trail/panel`
`{ trailId, panel, plan, context }` → `{ panel, copy | plan, path, ms, tokens }`.
Stage 2: copy for one page (`cover`, `route`, `listen`, `back`), or a re-roll of
one part of the plan (`ispy`, `riddle`, `sketch`). The UI calls it page by page,
so the sheet "prints" as each one lands.

### `POST /api/client-error`
`{ kind: render | runtime | promise | global, message ≤ 300, digest?, path ≤ 200 }` → `204`.
Error tracking without a third party: the error boundaries and a window
listener report crashes here (deduplicated, at most 5 per page load, via
`sendBeacon`), and they land in the server log as `"route":"client-error"`.
The query string is stripped from `path`; nothing else is stored.

### `POST /api/read` — SSE
`{ trailId, panelImages: {4,5,6,7: data URL ≤ 3 MB}, expected, omr, mode }`.
The reader. The browser has already found the fiducials, warped the photo and
cut the four panels, and measured ink in every checkbox (OMR). Gemma reads each
panel with a focused prompt; ticks are combined with OMR (agree → confident,
disagree → "check"); then a letter from The Trail Office.

Events: `status` → `step` per page (4, 5, 6, 7, then 0 for the letter) →
`report` (`report`, `labels`, `timings`, `paths`) or `error`.

## 4. The model path

**Provider chain.** `LLM_PROVIDER` is an ordered list (default on Render:
`gemini,ollama-cloud`). A call goes to the first provider; network errors,
timeouts, 408/429/5xx and auth errors move on to the next. Callers name the
primary's models; each provider maps them to its own Gemma build.

**Circuit breaker** (`lib/llm/breaker.ts`). Two failures in a row open a
provider's circuit for 30 s, doubling while failures continue (max 2 min); a
`429` with `Retry-After` opens it for exactly that long. While open, the
provider is skipped, so requests go straight to the next one instead of
waiting on a known-bad endpoint. If every provider is open, the one that
recovers soonest is tried anyway. A success closes the circuit.

**Model gate** (`lib/server/gate.ts`). At most `LLM_MAX_CONCURRENCY` (4) model
calls run at once per server; the rest wait in FIFO order. A call that waits
longer than `LLM_QUEUE_TIMEOUT_MS` (30 s) fails with `503 busy` + `Retry-After`
rather than piling up behind a slow provider. A queued call whose client has
gone away leaves the queue immediately.

**Cancellation.** The request's abort signal (and the SSE stream's `cancel`)
is passed to the model client, so closing the tab stops spending tokens.

**Capability adaptation.** Gemma on the Gemini API takes no system role and no
JSON schema, so those are folded into the prompt; endpoints that reject
`response_format` are detected once and switched to the in-prompt schema.
Gemma 4 on the Gemini API also *thinks* before answering by default; requests
send `reasoning_effort: "minimal"` (`GEMINI_REASONING_EFFORT`) so the token
budget goes to the answer, and any `<thought>…</thought>` block that still
comes back is stripped.

**Structured output loop** (`chatJSON`). Response → extract JSON (fences and
preambles tolerated) → zod → semantic checks → on any problem, one corrective
turn that quotes the exact problems → up to 2 retries → `LlmJsonError`.
Semantic checks include: I-Spy items grounded in real feature ids (≥ 6), the
riddle answer is a real waypoint, every text fits its printed box (measured
with the real font metrics), and **no internal ids are ever printed**
(`n9000024`, `W6` → "describe the place in words").

**Fallback.** `LlmJsonError`, a busy gate or a dead provider never reach the
user as a blank page: the writer drops to a deterministic template built from
the same features (`path: "fallback"`), and the UI labels it.

Every generation reports its `path`: `llm` (first try), `llm-retry`,
`fallback`, or `replay` (demo mode with recorded output).

## 5. Limits and timeouts

| What | Limit |
| --- | --- |
| Model call | `LLM_TIMEOUT_MS` (120 s) per call; route `maxDuration` 300 s |
| Concurrent model calls | `LLM_MAX_CONCURRENCY` (4) per server, queue wait `LLM_QUEUE_TIMEOUT_MS` (30 s) |
| Model calls per day | `LLM_DAILY_CALL_BUDGET` (2000) per server, reset at 00:00 UTC. Past it, writing falls back to the template and reading to the tick-counter. `0` stops all generation calls; `off` removes the cap. Health pings (≤ 1/min) are not counted. |
| `/api/trail/*`, `/api/read` | 40-request bucket per IP, refilling 20/min |
| Other `/api/*` | 120-request bucket per IP, refilling 60/min |
| Overpass / Nominatim / Open-Meteo | 30 s / 10 s / 10 s |
| Request body | 8 MB; each panel image ≤ 3 MB |
| Health ping | cached 60 s |

Rate limits and caches are in memory, per server. That is right for one
instance (the Render plan here); scaling out would move both to a shared store
(Redis / Render Key Value) without changing the interfaces.

## 6. Observability and privacy

Each request writes one JSON line to stdout (Render's log stream), e.g.

```json
{"t":"2026-10-10T13:02:11.204Z","rid":"3f9c1e0a2b7d","route":"trail.panel","status":200,"ms":1931,"panel":"cover","path":"llm","calls":1,"modelMs":1928,"provider":"gemini"}
{"t":"…","rid":"8be2…","route":"trail.plan","stream":"ok","ms":14117,"path":"llm","calls":1,"modelMs":14090,"provider":"gemini"}
```

Logged: route, status, timings, generation path, number of model calls, which
provider answered, cache hits, stream outcome (`ok` / `error` /
`client-gone`). **Never logged:** coordinates, place names, photos, handwriting,
the report, API keys. The writer additionally logs which problems a retry fixed
(e.g. "intro too long"), which is what the evals read.

Keys come only from environment variables (`GEMINI_API_KEY`,
`OLLAMA_API_KEY`); they are never sent to the browser, never logged, and never
committed.
