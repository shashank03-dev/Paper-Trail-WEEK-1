---
title: Every touch-grass app wanted to come with me. So I built one that stays home.
published: false
tags: devchallenge, hf26challenge, opensource, ai
---

<!-- Alternative title: "My phone stayed home. A 4B open model folded my street into paper." -->
<!-- TODO: paste the official DEV challenge template headings if they differ from the ones below. -->

*This is a submission for the [Hacktoberfest Open-Source AI Challenge, Week 1: Touch Grass](https://dev.to/challenges/hacktoberfest-week1-2026-10-05).*

## What I Built

I read about twenty-five "touch grass" entries before I started, and I noticed something funny. Almost every one of them wants you to go outside… and look at your phone. Take a photo to prove you saw the tree. Check the app for your next quest. Get a notification that you've been outside for 10 minutes.

That's not touching grass. That's carrying a screen to the grass so it can watch.

Then I remembered the **I-Spy books**. From 1948, kids in Britain carried little paper spotter books (*I-Spy on the Pavement*, *I-Spy Trees*), ticked off what they saw, and mailed the finished book back to the club. A reward came back by post. Over 25 million copies. No battery.

So I wondered: what if a tiny open model could be the person at the other end of the mail?

**Paper Trail** turns your real neighbourhood into a one-sheet, 8-page paper zine, written by Gemma 4 running on your own machine. You print it, cut it once, fold it, and **leave your phone at home**. When you come back, you take one photo of the scribbled sheet, and Gemma reads your pencil ticks, your handwriting and your wobbly sketch, then stamps your Trail Book.

The zine has:

1. **A cover** with a title written for *your* street ("The Secret Life of Alder Street"), the weather and a PHONE STAYS HOME stamp.
2. **A hand-drawn map** of the real streets around you, drawn in code from OpenStreetMap with rough.js. Parks are hatched, water wiggles, your loop is a dotted pink line.
3. **The route**, as landmark directions: "Walk toward the big oak at the corner…"
4. **I-Spy:** 8–10 things to tick, at least six of them real mapped features near you. Rarer things score more.
5. **Listen:** stand still for 60 seconds and write down the loudest, the quietest, and a sound you'd never noticed.
6. **A riddle** whose answer is a real thing on your route.
7. **A sketch box:** "Draw the strangest tree on your route." (With a dog: "Draw your dog's favourite smell. Somehow.")
8. **Bring me home:** a QR code and a colophon that says where the words came from.

![TODO: photo of the printed sheet, flat on a table](...)

![TODO: photo of the fold — one cut, then the booklet](...)

## Demo

![TODO: photo of the phone face-down on the table, door in the background](...)

<!-- TODO: embed the 75-second video (script in docs/demo-script.md) -->

TODO: deployed link (Render) — or "run it locally, it's three commands".

<!-- TODO: make this paragraph match your real walk. -->
Here's the bit I still grin at. I came back, unfolded a slightly damp sheet, and took one photo. The browser found the four black corner squares, flattened the photo, cut it into pages, and sent four small crops to the model on my laptop.

**A 4-billion-parameter model on my laptop read my pencil handwriting, judged my riddle, and kindly described my terrible tree.**

![TODO: the scribbled sheet in hand, outside](...)

![TODO: screenshot of the Field Report with the stamp](...)

The Field Report ends with the number I built the whole thing for:

> **Screen: TODO · Outside: TODO.** My screen was TODO% of this adventure.

## Code

{% github shashank03-dev/Paper-Trail-WEEK-1 %}

MIT licensed. Next.js 15, TypeScript, Tailwind 4, rough.js, Dexie, and Gemma 4 through Ollama's OpenAI-compatible API.

## How I Built It

**The paper is one SVG, in millimetres.** The 4×2 grid, the standard one-cut imposition (top row 5·4·3·2 upside down, bottom row 6·7·8·1), the dashed cut, and four QR-style corner markers all come from one layout file. The preview, the print, the PDF and the reader all use the same numbers, so the preview really is the print. A `/fold-test` page with giant page numbers checks the fold before you print the real thing.

**Text has to fit a 67 mm page.** SVG doesn't wrap text, so I generated advance-width tables from the actual font files and wrote a small `fitText` that shrinks, then truncates. The server runs the same check on everything Gemma writes. Too long? Gemma gets "stop 3 text too long" and tries again.

**Gemma writes, but doesn't navigate.** A boring deterministic planner picks a 5–6 stop loop that fits your time (4.5 km/h, ×1.3 for real streets). Gemma gets that route plus the nearby features as compact lines, like `n123 | bench | "Memorial bench" | 140m NE`, and has to cite ids. Every answer goes through a JSON schema, then zod, then a grounding check: every featureId must exist, at least six I-Spy items must be real, the riddle's answer must be a waypoint. If it fails, the model gets the exact problem and another go. If it keeps failing, a template built from the same real features takes over. The app never dead-ends, and it tells you which path it took.

**Reading is where the open model earns its keep.** One big photo of a whole sheet is a lot to ask of a small model. So the browser does the geometry first: adaptive threshold, connected components to find the corner markers, a hand-written 4-point homography, an inverse-mapped warp. Then it cuts the four pages that matter and sends each with its own focused prompt and what to expect ("row 3 should say *a red post box*"). For ticks there's a second opinion that needs no AI at all: because I know exactly where every checkbox was printed, I measure the pencil darkness inside each one. When Gemma and the ink agree, it's confident. When they disagree, the report asks you to tap.

Measured so far (no model needed): the corner markers were found on **30 of 30** synthetic phone photos (tilted, rotated, shadowed, blurred), and ink-counting alone got **100%** of their ticks. Synthetic photos are kinder than a real crumpled sheet, so I'm treating that as the ceiling.

| Reader | Tick accuracy | Handwriting CER | Riddle verdicts | s / sheet |
| --- | --- | --- | --- | --- |
| E2B · whole sheet | TODO | TODO | TODO | TODO |
| E2B · per panel | TODO | TODO | TODO | TODO |
| E2B · per panel + OMR | TODO | TODO | TODO | TODO |
| E4B · whole sheet | TODO | TODO | TODO | TODO |
| E4B · per panel | TODO | TODO | TODO | TODO |
| E4B · per panel + OMR | TODO | TODO | TODO | TODO |

<!-- TODO: paste from evals/results/reader.md and writer.md after `pnpm eval:reader` / `pnpm eval:writer` against Ollama. -->

The writer eval runs 36 trails per model (3 places × 3 lengths × 4 kinds of company) and counts schema-valid-first-try, grounding, hallucinated places after validation (it should be zero, and the test suite has a fake model that hallucinates a statue on purpose), and whether everything fits its panel. TODO: one line on what surprised you.

I built it with an AI coding agent and recorded every session with Entire. They're on a side branch of the repo, so you can see exactly how each piece came together. 79 unit tests and 8 browser tests run the whole app, preview to Trail Book, against a mock model.

## Why Open Innovation Matters Here

This one isn't abstract for me.

- **My home location and my handwriting never leave my machine.** Paper Trail reads a map of where I live and a photo of my notes. With Gemma in Ollama on my laptop, neither goes anywhere. No accounts, no analytics; my Trail Book lives in my browser.
- **It works offline after printing.** It's paper. The most reliable part of the stack is a pencil.
- **I swapped E2B and E4B with one env var** and measured what it cost (see the table). On a CPU server E2B is the sensible choice. TODO: one line on what E4B bought you on your laptop.
- **Apache-2.0 weights mean anyone can run this for free.** A teacher could print thirty different trails for a class, all starting from the school gate, on the school's own computer, with nobody's API key.
- **A closed API would have meant sending a map of my neighbourhood to someone else's server** for every walk, plus a photo of my handwriting when I got back. For an app whose whole point is leaving the screen behind, that felt exactly backwards.

### Honest limits

- OpenStreetMap coverage varies. In thinly mapped places the I-Spy list leans on "ambient" items, like a cloud shaped like an animal.
- Bad light hurts. A hard shadow across the checkboxes can fool both the ink counter and the model, which is why every item is one tap to fix.
- CPU inference on Render is slow (TODO tok/s), so the zine prints itself panel by panel instead of making you wait.
- Small models still misread handwriting sometimes. The report never pretends otherwise.

## Prize Categories

- **Best Use of Gemma:** Gemma 4 is both the writer (grounded, schema-checked zine copy) and the reader (handwriting, riddle judging, sketch descriptions from four focused crops), running locally through Ollama.
- **Best Use of Render:** the `render.yaml` Blueprint runs Gemma itself on Render, an Ollama private service with a persistent model disk next to the web app, so there's no closed API anywhere in the stack.
- **Best Use of Entire:** the whole build was done with an agent and recorded by Entire on `entire/checkpoints/v1`, linked above so you can replay how it was made.

---

Print one this weekend. Leave your phone. Tell me what you spied.
