# Paper Trail — 15-second launch video

A 15-second launch film for DevPost and social, drawn entirely in code from the product's own
renderers: the real zine (`lib/zine/Sheet.tsx`, `PageSvg.tsx`), the landing page's paper-fold
model (`components/landing/foldSheet.ts`) and paper grain (`paperTexture.ts`), and the logo
(`public/icon.svg`). No footage, photos, stock or generated images; every sound is synthesised.

## Deliverables (`video/out/`)

| File | What |
| --- | --- |
| `paper-trail-launch-1920x1080.mp4` | Main cut, 1920×1080, 60 fps, 15.000 s, H.264 + AAC |
| `paper-trail-launch-1080x1350.mp4` | Social cut, 1080×1350 (4:5), relaid out, not cropped |
| `paper-trail-vo.wav` | Voiceover on the timeline (48 kHz, 24-bit) |
| `paper-trail-music-sfx.wav` | Music (ducked under the voice) + sound effects |
| `paper-trail-mix.wav` | The master: −16 LUFS integrated, −1 dBTP |
| `paper-trail.srt` | Captions (also burned into both cuts) |

## Re-render

```bash
pnpm install
pnpm video:zine                      # the real zine + pencil marks → video/build/zine.json
pnpm video:render                    # both cuts → video/out (≈1 h each on a 4-core CPU, software WebGL)
pnpm video:render --format 16x9 --stills 0.6,5.6,12.2   # quick PNG checks
pnpm video:render --subframes 1 --subframes-fast 1   # fast draft, no motion blur
```

The voiceover clips are committed (`video/build/vo`), so the above is all you need. To regenerate
the audio (Python 3.12, CPU only):

```bash
python3.12 -m venv .venv && . .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install kokoro soundfile numpy scipy pyloudnorm \
  "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
python video/audio/voiceover.py      # Kokoro-82M, af_heart, speed 0.92 → video/build/vo
python video/audio/mix.py            # music, sfx, ducking, loudness → video/out/*.wav + .srt
pnpm video:render                    # re-mux with the new mix
```

Every timing lives in `video/cues.json` (seconds, on a 100 BPM grid): the scene and the mixer
both read it, so picture and sound can't drift apart.

## How it's built

- `scene/index.html` + `scene/main.ts`: one page, `window.seek(t)` draws the frame at time `t`
  as a pure function of time (no timers, no CSS transitions, no state between frames).
- `scene/stage.ts`: three.js desk. The sheet is a 168×96 grid bent by the landing page's
  `foldVertices`: each flap rolls around a crease of growing radius, so layers wrap instead of
  intersecting, and the paper bows while it moves. Soft VSM shadows on a shadow catcher.
- `scene/sheetTexture.ts`: the sheet's face. The real zine is rasterised once and multiplied onto
  code-drawn paper grain panel by panel (riso ink on paper), with a print-head line, the dotted
  route and later the pencil marks drawn into the same texture so they fold and tilt with it.
- `scene/overlays.ts`: pin, labels, stamps, the pencil close-up (real page SVGs, ticks drawn by
  dash offset, the pencil tip riding the stroke), viewfinder, fiducial markers projected from
  the sheet's actual corners, the Field Report, the end card and captions.
- `render.ts`: serves the scene (TypeScript transpiled on the fly with the repo's `typescript`),
  drives it with Playwright and averages sub-frames into each frame for motion blur: 2 per frame,
  5 during the fast moves listed in `cues.json` → `blur`, so quick moves smear instead of ghosting.

## Research: prompt-motion.com, Product UI tag

I read all 100 entries tagged Product UI and their full prompts. Most are one-liners ("make a
dynamic 15-second motion graphics video … go all out"); about a dozen are detailed production
briefs. The three I built from:

1. **Shape morphing through UI states** (@twoclipping, `/twoclipping-5cba86`): one element that
   is never cut, only changes state. Paper Trail is one sheet that goes blank → printed → folded
   → photographed → flattened → folded again. Also its build rules: `seek(t)` as a pure function,
   closed-form no-overshoot springs, sub-frame motion blur, a still per beat before the full render.
2. **mdfor.dev product intro video** (@HO_BA, `/ho-ba-f3f0e9`): use real product assets, broken
   into animatable parts, never raw screenshots, with motion cut to the music. Here: the zine is
   the product's own SVG, page by page; the Field Report, stamp and logo are rebuilt from the app.
3. **Photo print app launch film** (@twoclipping, `/twoclipping-221cab`): a physical-print story
   where every scene is made out of the previous one; sounds placed by their measured peak, not
   their file start; check one frame per beat and scan for pops.

Also borrowed: the voice handling of **Ora 2 image model launch film** (@rossaxbt) — word
timings from the TTS, captions lit word by word as they're spoken — and the "15 seconds, showreel,
go all out" brief of **Dub promo video** (@steventey), which on its own is a one-line prompt.

## The production prompt

> **Paper Trail — 15 s launch film. 1920×1080 and 1080×1350, 60 fps.**
>
> **Direction.** A paper studio, not a tech demo. One sheet of US Letter paper is the hero and is
> never cut away from: it lands, gets planned, prints, folds, goes for a walk, comes back, is
> photographed, flattens, and folds again for the end card. Desk #F1EDE4, paper #FBFAF6, ink
> #151412 / #46433D, riso blue #2B3DD8 (the only accent), postmark red #C8402A for stamps.
> Instrument Serif headlines with the accent word in italic, Instrument Sans UI, Fragment Mono
> labels, Kalam for pencil. Everything is drawn in code: the zine is the product's own SVG, the
> 3D sheet is the landing page's fold model, the logo is `public/icon.svg`.
> Paper moves like paper: folds roll around the crease with a radius, flaps bow while they swing,
> layers wrap and never pass through each other, a soft contact shadow is always under it.
> Springs are critically damped (no overshoot). Banned: glows, neon, glassmorphism, lens flares,
> bouncy easing, tech particles, fake features (maps app, accounts, social feed, turn-by-turn),
> and "never leaves your machine" (the live site uses a hosted model).
>
> **Beats (100 BPM, 0.6 s beat).** 0.0 the sheet drops in and lands on beat 1 · 1.2 a blue pin
> drops on beat 2 · 1.75 a dotted route draws a loop from the pin · 2.1 "GEMMA 4 · OPEN MODEL"
> label · 2.4–4.9 the 8 panels print one per eighth note, each wiped in under a print-head line,
> covering the route; a page counter ticks 1→8 · 4.8 the sheet lifts · 5.35 it folds by hand:
> the long crease rolls up toward camera, then the concertina, a beat apart · 6.15 the phone
> slides out of frame · 7.2 "PHONE STAYS HOME" stamps where it lay · 7.8 cut to the open I-Spy
> spread; a riso-blue pencil ticks six boxes on 16ths, tip riding each stroke · 9.05 a
> viewfinder over the unfolded, pencilled sheet in perspective · 9.9 shutter blink · 10.05–10.23
> four markers snap onto the printed fiducials (projected from the 3D sheet), the quad draws ·
> 10.4 the photo flattens · 10.95 a band reads the I-Spy page; each tick turns into a chip ·
> 11.35 the Field Report slides in; the chips fly into it and become its checkboxes, counting
> up to "6 of 8 found" · 12.15 the postmark lands · 12.55 the report drops away, the sheet folds
> itself into the booklet and settles right · 12.95 "The walk app that / *stays home.*" rises
> word by word with the voice · URL in mono · 14.5–15.0 held last frame.
>
> **Voice.** Kokoro-82M, af_heart, speed 0.92, one clip per line, silence trimmed, placed on its
> beat; warm and unhurried, a friend handing you a map. Captions burned in, every word lighting
> up as it's spoken (the end card's headline is the last caption).
>
> **Sound.** Original warm lo-fi at 100 BPM in D (Rhodes-style FM keys, nylon Karplus-Strong
> arpeggio, soft bass, brushed kit that enters with the printing and drops out for the end card,
> resolving on Dmaj9 under the held frame). Synthesised foley placed by peak: paper landing,
> pin tap, paper rustle on both folds, the phone sliding, stamp thumps, pencil scratches,
> shutter, marker ticks. Music ducked 10 dB under the voice; master −16 LUFS, −1 dBTP.
>
> **Build.** `seek(t)` pure function; three.js for the paper, DOM/SVG over it; Playwright one
> frame at a time, sub-frames averaged for motion blur (more of them on fast moves); ffmpeg. Render a still per beat before
> the full render; check every claim, every text edge, every fold.

## Claims (all true of the product today)

- "Gemma writes your neighbourhood into an eight-page zine" — Gemma 4 via Ollama/Ollama
  Cloud/Gemini API (`lib/config.ts`); 8 panels (`lib/zine/layout.ts`). The zine shown is the
  product's own renderer fed the Dolores Park demo preset (deterministic writer, real OSM data);
  its colophon is the hosted-mode one ("via Ollama Cloud … your trail lives in your browser").
- One US Letter sheet, folds into a booklet: same imposition and fold order as the product.
- I-Spy, riddle, sketch: real panels. The I-Spy list has 8 items (the schema allows 8–10).
- Four corner markers: the sheet's real fiducials (`sheetGeometry().fiducials`).
- "6 of 8 found" and "135 pts": computed by `lib/reader/score.ts` from the marks drawn.
- Not shown or implied: maps app, accounts, social feed, navigation, "never leaves your machine".

## What I couldn't do

- **Listen.** I can't hear audio. I checked it by measurement instead: loudness (−16.1 LUFS,
  −1.0 dBTP by ffmpeg's EBU R128 meter), ducking (music 9.9 dB lower while the voice speaks; voice
  ≈9.5 dB over the music), a spectrogram and stems, and a Whisper speech-to-text pass on the final
  mix, which recovers every line at its cue. It hears "zine" as "scene"; Kokoro's phonemes are
  /zˈin/ ("zeen"), so that's the recogniser's vocabulary, but it's worth a listen.
- **Voice choice by ear.** Both af_heart and bm_george ran. I kept af_heart because Kokoro's
  own voice card grades it A (bm_george: C) and its timing fit 15 s (4.7 s vs 5.6 s for the
  first two lines). A human ear should confirm.
- **Downloaded CC0 music/SFX.** Everything is synthesised instead (no licence questions), which
  also means the "acoustic" guitar is a plucked-string model, not a recording.
