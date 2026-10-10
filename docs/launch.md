# Launch runbook

What to do when the live site misbehaves, and the switches that stop it
costing money. The site is one Render web service (Docker) that redeploys on
every push to `main`.

## How deploys work

Render's GitHub App is installed on this repository (and only this one), so a
push to `main` starts a build within a minute; it shows in Render → *Events*
as triggered by a new commit. The build takes about two minutes, and the old
version keeps serving until the new one is up.

If a push doesn't start a deploy, check that the Render app still has access
to the repository (GitHub → *Settings* → *Applications* → *Render*) and that
*Auto-Deploy* is *On Commit* in the service's settings. A one-off deploy can
always be started from the dashboard with *Manual Deploy*.

## Roll back

1. **Fastest: redeploy the last good build.** Render dashboard → the service →
   *Events* → the last deploy that was live and healthy → *Rollback*. It
   reuses that build, so it is back in about a minute. Render turns off
   auto-deploy after a manual rollback; turn it back on (*Settings* →
   *Auto-Deploy*) once `main` is fixed.
2. **Durable: revert on `main`.**

   ```bash
   git checkout main && git pull --ff-only origin main
   git revert --no-edit <bad-sha>      # one commit per bad change, newest first
   pnpm lint && pnpm typecheck && pnpm test
   git push origin main                # Render rebuilds from the revert
   ```

   Never force-push `main`; a revert keeps everyone's checkout valid.
3. **Verify.** `GET /api/config` returns 200 (it is the health check),
   `GET /api/health` reports the model, and the landing page loads.

Nothing to migrate back: the server keeps no database. Trails live in each
visitor's browser (IndexedDB), so a rollback never loses anyone's data.

## Kill switches (environment variables, no code change)

Change them in Render → *Environment*; saving restarts the service.

| Switch | Effect |
| --- | --- |
| `LLM_DAILY_CALL_BUDGET=0` | No model calls at all. Writing uses the built-in template, reading uses the tick-counter. The site still works end to end. |
| `LLM_DAILY_CALL_BUDGET=<n>` | Cap model calls per day (default 2000, resets 00:00 UTC). |
| `DEMO_MODE=true` | Replays recorded Gemma output for the preset neighbourhoods; no Overpass, Nominatim or Open-Meteo calls. |
| `LLM_MAX_CONCURRENCY` | Fewer simultaneous model calls; the rest queue, then get `503 busy`. |
| `LLM_PROVIDER` | Reorder or drop a provider from the fallback chain, e.g. `ollama-cloud` alone if Gemini is failing. |
| Remove a key | Removing `GEMINI_API_KEY` / `OLLAMA_API_KEY` drops that provider from the chain. |

## Rotate a key

1. Create a new key: Google AI Studio → *API keys*, or ollama.com →
   *Settings → Keys*.
2. Paste it into Render → *Environment* (`GEMINI_API_KEY` / `OLLAMA_API_KEY`)
   and save; the service restarts with it.
3. Check `GET /api/health?fresh=1` answers, then delete the old key at the
   provider.

Keys exist only in Render's environment. They are never committed, never sent
to the browser and never logged.

## Spending limits at the providers

The daily budget above is the app's own ceiling. Set one at each provider too,
so a bug can't outrun it:

- **Gemini API:** in Google Cloud console for the key's project, set a budget
  with alerts (*Billing → Budgets & alerts*) and lower the per-minute and
  per-day request quotas for the Generative Language API (*APIs & Services →
  Quotas*).
- **Ollama Cloud:** check the plan's usage limits at ollama.com/settings.

## Watch it

Render → the service → *Logs*. Every request is one JSON line (see
[api.md §6](api.md#6-observability-and-privacy)). Useful searches:

| Search | Means |
| --- | --- |
| `"route":"client-error"` | A page crashed in someone's browser (message, path, digest). |
| `"stream":"error"` | A writing or reading stream failed; `err` has the cause. |
| `"status":5` | Server errors (500, 502, 503). |
| `"path":"fallback"` | The model didn't answer in time and the template was used. |

Today's model spend is on `GET /api/health` as `gate.budget` (`used` of
`limit`); when `used` reaches `limit`, every trail falls back to the template
until midnight UTC.

Render → *Metrics* shows request counts, response times, memory and CPU,
which is all the traffic data the site keeps (it has no analytics, by design).

## Known limits

- **Free plan cold start.** An idle free service sleeps after 15 minutes; the
  next visitor waits about a minute while it wakes. Move to the Starter plan
  before a launch spike to keep it warm.
- **One instance.** Rate limits, caches and the daily budget are in memory,
  per server. Scaling out would move them to Render Key Value.
- **Model latency.** A full trail takes 15–40 s on the hosted Gemma models.
  The UI streams progress and falls back to the template on timeout.
