# Contributing

Thanks for helping! Paper Trail is a Hacktoberfest project and small, focused PRs are very welcome.

## Good first contributions

- **A new zine edition** (night walk, bird morning, rainy day, school trip…). Editions are prompt + layout tweaks: start in `lib/prompts/writer.ts` (what Gemma is asked), `lib/writer/fallback.ts` (the deterministic template) and `lib/zine/panels.tsx` (how a page is drawn). Open an issue with the *New zine edition* template first.
- **A new language.** Gemma is multilingual; the hard parts are UI strings, prompts and fonts that cover the script. If you add a font, regenerate metrics with `pnpm fonts:metrics`.
- **A new demo preset** in a well-mapped, walkable place: add it to `lib/presets.ts`, then run `pnpm fixtures:fetch` and commit the fixtures.
- **Better reading:** improve fiducial detection or OMR in `lib/vision/`, and prove it with `pnpm eval:reader`.

## Rules of the house

- **Open models only.** Every AI call goes through `lib/llm/client.ts` to an OpenAI-compatible endpoint of an open-weights model. PRs that add a closed-model API won't be merged.
- **Privacy:** no analytics, no third-party requests at runtime, no accounts.
- **The zine is drawn in code.** No images on the printed sheet.
- **Geometry lives in `lib/zine/layout.ts`.** The renderer, OMR and crops all read from it.
- **Every model call needs a fallback** so the main path never dead-ends.

## Setup

```bash
pnpm i
pnpm mock:llm &                                   # a fake model for development
LLM_BASE_URL=http://127.0.0.1:11435/v1 pnpm dev   # or point at a real Ollama
```

Before opening a PR:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

If you change the sheet layout on purpose, update the visual snapshot with `pnpm test:e2e --update-snapshots` and print `/fold-test` to check the fold.

## Licence

By contributing you agree your work is released under the MIT licence.
