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
- **Pitch Thrown**: click whatever the pitcher actually threw, grouped into
  four display columns (Fastball / Breaking / Off-speed / Other) — see
  `src/lib/pitchThrownLayout.ts`. The predicted pitch is marked with a small
  blue dot. Pitch Out is intentionally not selectable here.
- **Step 1 — Pitch Result** (Ball / Strike / Foul) then unlocks **Step 2 —
  At-Bat Result**, also grouped into four columns — In Play — Reach Base, In
  Play — Out, In Play — Sac, No Contact (see `src/lib/atBatResultLayout.ts`).
  The moment Step 1 is answered, Step 2 defaults to "At Bat Still In
  Progress" (by far the most common outcome) so most pitches only need one
  click; picking anything else in Step 2 overrides that default.
- **Log Pitch** sits in the right-hand column, directly under Session
  Accuracy — that column is sticky, so both stay on screen regardless of
  how far the game-situation form on the left has scrolled. Logging scores
  the pitch, advances the count/outs, and resets the three-step form for
  the next pitch. This flow lives in `src/hooks/usePitchLogging.ts`.
- **Session accuracy** is scored two ways per logged pitch, using the whole
  session's log even though the table below only ever shows the 10 most
  recent rows (scrollable):
  - **True accuracy** — 1 if the predicted pitch exactly matches what was
    thrown, 0 otherwise.
  - **Adjusted accuracy** — 1 for an exact match, 0.75 if the prediction and
    the actual pitch are in the same scoring family (e.g. four-seam
    predicted, sinker thrown — both Fastball), 0 otherwise.
  - Scoring families: **Fastball** (four-seam, sinker, cutter), **Breaking
    Ball** (slider, sweeper, slurve, curveball, knuckle curve, slow curve),
    **Off-speed** (changeup, split-finger, forkball, screwball, knuckleball,
    eephus). Mapping lives in `src/lib/pitchCategories.ts` — deliberately
    separate from the Pitch Thrown selector's display columns above, which
    group knuckleball/eephus into their own "Other" column without changing
    how they're scored.

## Run locally

Requires Node.js 18.17+.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm test           # jest + React Testing Library
npm run test:watch # jest in watch mode
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

## Backend & data pipeline

The real roster (`src/data/players.ts`) and prediction data are generated
by the ETL pipeline in `backend/`, which also keeps itself current on a
schedule. See [`backend/README.md`](backend/README.md) for how the
pitch/roster data is fetched, kept fresh, tested, and republished.

## Project structure

```
src/
  app/                 Next.js App Router entry (layout, page, globals.css)
  components/          Presentational + interactive UI components
  data/players.ts       Mock roster + search
  lib/predictionService.ts   Mock prediction model (the future backend seam)
  lib/format.ts         Small display formatters (percent, score diff, etc.)
  lib/pitchCategories.ts     Accuracy-scoring pitch families (Fastball/Breaking/Off-speed)
  lib/pitchThrownLayout.ts   Pitch Thrown selector's 4 display columns
  lib/atBatResultLayout.ts   At-Bat Result selector's 4 display columns
  hooks/useGameState.ts Central game-situation state
  hooks/usePitchLogging.ts   Pitch Thrown / Result / At-Bat Result form + log-pitch flow
  types/index.ts        Shared domain types
```
