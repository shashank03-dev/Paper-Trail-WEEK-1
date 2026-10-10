# How it was built

Paper Trail was built in a few days for the DEV Hacktoberfest Open-Source AI Challenge, with an AI coding agent doing most of the typing while I steered: the idea, the brief, the design calls, the printing, the walking and the photos are mine.

## The sessions are in the repo

The agent sessions were recorded with the [Entire CLI](https://docs.entire.io/cli/overview), which saves them to a side branch:

```bash
git fetch origin entire/checkpoints/v1
git log --oneline origin/entire/checkpoints/v1
```

Each checkpoint links a commit on `main` to the session that produced it, so you can see the prompt, the plan and the back-and-forth behind any change.

## Notable sessions

- TODO: link — the first session: from the brief to a printable sheet (imposition, fiducials, rough.js map).
- TODO: link — the reader: fiducial detection, homography and OMR, tested on synthetic phone photos.
- TODO: link — the moment the grounding check caught a hallucinated statue.

## What the process looked like

1. A written brief (`build-prompt.md`) with hard rules: open models only, privacy, never dead-end, print accuracy.
2. A design pass (`docs/design.md`) before code: the sheet as one mm-exact SVG, text metrics from font files, fiducials in the panel footers, two-stage generation.
3. Milestones, each committed with the app runnable: paper → writer → reader → polish → proof.
4. Tests written alongside: 79 unit tests and 8 Playwright e2e tests against a mock model, plus eval harnesses for real Gemma.
