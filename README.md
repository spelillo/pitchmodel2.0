# PitchModel 2.0 — Frontend (Windows 95 / 1990s Retro Edition)

A next-pitch prediction workspace for baseball analysts, styled as an
authentic 1997 desktop application: `pitchmodel.exe`, navy title bars,
3D outset/inset bevels, a scrolling marquee, and a lime-green hit-counter
prediction display. This is the **frontend only** — it talks to a mock
prediction service today and is built so a FastAPI backend (`POST /predict`)
can be swapped in later without a redesign.

## Session tracking & accuracy

- **Start / End Session** (top toolbar): tracks elapsed time and how many
  pitches have been logged. Ending a session stops the timer but keeps the
  log visible; starting a new one clears it.
- **Log Actual Pitch Thrown**: appears directly under every prediction. The
  predicted pitch is marked with a small blue dot — click whatever was
  actually thrown to log it. Logging also carries that pitch forward as
  "Previous Pitch" for the next prediction.
- **Session accuracy** is scored two ways per logged pitch:
  - **True accuracy** — 1 if the predicted pitch exactly matches what was
    thrown, 0 otherwise.
  - **Adjusted accuracy** — 1 for an exact match, 0.75 if the prediction and
    the actual pitch are in the same family (e.g. four-seam predicted,
    sinker thrown — both Fastball), 0 otherwise.
  - Pitch families: **Fastball** (four-seam, sinker, cutter), **Breaking
    Ball** (slider, sweeper, curveball), **Offspeed** (changeup, splitter).
    Mapping lives in `src/lib/pitchCategories.ts`.

## Run locally

Requires Node.js 18.17+.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

## Where the backend will plug in

`src/lib/predictionService.ts` exports `predictNextPitch(request)`, which
currently simulates a KNN-style response with a small deterministic mock
model. Replace its body with a `fetch("/predict", { method: "POST", ... })`
call to the FastAPI backend and keep the same `PredictionRequest` /
`PredictionResult` shapes (defined in `src/types/index.ts`) — no component
needs to change.

`src/data/players.ts` similarly isolates the mock roster. Swap it for a real
roster/Statcast-backed fetch later.

## Project structure

```
src/
  app/                 Next.js App Router entry (layout, page, globals.css)
  components/          Presentational + interactive UI components
  data/players.ts       Mock roster + search
  lib/predictionService.ts   Mock prediction model (the future backend seam)
  lib/format.ts         Small display formatters (percent, score diff, etc.)
  hooks/useGameState.ts Central game-situation state
  types/index.ts        Shared domain types
```
