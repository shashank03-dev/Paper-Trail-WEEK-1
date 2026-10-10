# Decisions

Short record of the calls made during the build and why. Longer reasoning lives in [docs/design.md](docs/design.md).

1. **The sheet is one SVG in millimetres.** One drawing serves the preview, print, the PDF export and the synthetic photos, and every coordinate the reader needs (checkbox rectangles, panel cells, fiducials) comes from the same `lib/zine/layout.ts`.
2. **Text is measured from real font metrics, not the DOM.** `scripts/gen-font-metrics.ts` reads the self-hosted font files and writes advance widths. `fitText` gives the same line breaks in the browser, on the server (where generated copy is checked before it's accepted) and in scripts. Kerning is ignored; boxes have a little slack.
3. **Fiducials live in the panel footers.** With the standard imposition every sheet corner lands in a panel-local bottom corner of pages 1, 2, 5 and 6, so every panel reserves a 12 mm footer and nothing collides.
4. **The cut runs across the middle two columns.** The brief's "between panels 3|2 and 7|8" conflicts with its own "centre two columns". The standard one-cut zine cuts the centre two columns (between 4|3 above and 7|8 below), so that's what's printed. `/fold-test` exists to catch any mistake.
5. **Route selection is deterministic.** Greedy insertion by interest ÷ added distance, nearest-neighbour ordering, then 2-opt. Gemma is given the route; it never chooses where you walk.
6. **Two-stage generation.** One structured plan call (temperature 0.2), then one call per copy panel (0.7–0.8). That gives the "printing press" reveal, makes "re-roll one panel" cheap, and keeps each schema small enough for a 4B model.
7. **`chatJSON` is the only way to ask for JSON.** JSON-schema `response_format` → tolerant JSON extraction → zod → semantic checks (grounding, fit) → retry with the exact problems (≤ 2) → caller falls back to a template. The path taken (`llm`, `llm-retry`, `replay`, `fallback`) is logged and shown in the UI.
8. **Ollama native `/api/chat` is behind a flag** (`LLM_OLLAMA_NATIVE=true`), for Ollama versions where `/v1` structured output misbehaves.
9. **Reading is per-panel plus OMR.** Four small focused crops beat one big photo for a small model; the checkbox ink measurement is a cheap, model-independent second opinion. Disagreements are surfaced, not hidden.
10. **The riddle is judged twice.** A lenient deterministic match (normalisation + Levenshtein against the answer and `acceptable[]`) decides clear cases; Gemma's verdict decides the rest.
11. **Client-side vision.** Fiducial detection, homography and warp run in the browser in plain TypeScript (no OpenCV). Only four cropped PNGs go to the model endpoint.
12. **Client-side PDF.** The SVG is rasterised at 300 dpi with fonts inlined as data URIs and placed on an exact-size page with pdf-lib. pdf-lib is loaded only when you click the button. Browser "Print → Save as PDF" is the vector option.
13. **Fonts are self-hosted, not Google Fonts.** Same families as the brief (Fraunces, Inter, IBM Plex Mono, Caveat), but no third-party request when the app opens, which fits the privacy promise.
14. **3D in CSS, not WebGL.** The folding hero, sheet tilt, booklet page turn, Trail Book shelf and stamp slam are CSS 3D transforms. three.js would cost ~150 kB and fight print and reduced motion. The resting sheet is never transformed, so it stays print-crisp.
15. **3D icons from Fluent Emoji (MIT), UI only.** The brief says the zine has zero external assets; that stays true. The app chrome uses self-hosted Fluent 3D emoji, animated with CSS.
16. **B&W is the default** because most home printers are mono. Colour mode adds the pink and teal spot colours; B&W swaps fills for hatching.
17. **Pink text uses a deeper "rose" (`#C2295A`)** so it passes WCAG AA on cream; pink buttons use ink text for the same reason.
18. **Demo presets are hand-traced.** The build environment could not reach Overpass, so `scripts/seed-fixtures.ts` traces three real places (Cubbon Park in Bengaluru, Vondelpark in Amsterdam, Dolores Park in San Francisco) in Overpass format and runs them through the real normaliser. `pnpm fixtures:fetch` replaces them with live OSM.
19. **Replays are honest.** Demo replays are recorded per preset and task; until someone runs `pnpm fixtures:record` against Gemma, they're labelled as mock placeholders in the files, and the UI always shows a "replay" badge.
20. **Screen time = visible time only.** The Page Visibility API counts active time per trail (setup is parked under a pending id and adopted when the trail is created). Outside time = photo time − print time, capped at 3 h.
21. **Server is stateless.** No database: trails live in IndexedDB. The server only proxies OSM / weather / geocoding (to cache and send a proper User-Agent) and talks to the model.
22. **Rate limiting is an in-memory token bucket** in middleware (120/min general, 40 burst for model routes) and uploads are capped at 8 MB. Good enough for a demo; put a real limiter in front for anything bigger.
23. **The endpoint override is off by default.** Letting a public page point the server at arbitrary URLs is an SSRF; models can still be switched per browser.
24. **Standalone output only for Docker** (`NEXT_OUTPUT=standalone`), so `pnpm start` works locally and in e2e.
