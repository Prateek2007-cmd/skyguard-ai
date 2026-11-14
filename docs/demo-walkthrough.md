# SkyGuard — SIH demo walkthrough (5 minutes)

Audience: SIH judges (PS 73, MoES/IMD). Goal: prove the pipeline is real,
explainable, and honest. Every number shown comes from the running system.

## Before the demo

1. Start the backend: `cd backend && uvicorn main:app --port 8000`
   (or with the demo DB: `SKYGUARD_DB_PATH=backend/demo.db ...`).
2. Start the frontend: `cd frontend && npm run dev` → http://localhost:5173
3. Check `/api/v1/health` shows `onnx_lstm_ready: true`.
4. If the venue IP has no Open-Meteo quota left, the live panels show an
   error state — say so plainly, then demo on the seeded DB (history,
   alerts, health, evaluation all work) and run the simulation, which
   needs Open-Meteo for its baseline. The 10-minute upstream cache means a
   brief quota window still covers the whole demo.

## Minute 0–1 — Landing + the problem

- Open `/`. Headline: *Weather Intelligence. Without Blind Spots.*
- Say: "A weather station can report 55 °C on a 28 °C day. If that reading
  flows into forecasts, everything downstream is wrong. SkyGuard tells a
  real weather event apart from a broken sensor — and repairs the data."
- Point out the honesty line: 6 virtual stations on live Open-Meteo data,
  LSTM trained on synthetic data. Judges notice honesty.

## Minute 1–2 — Command Center (live)

- **Launch Command Center** → `/app`.
- Map: 6 stations in a 40 km ring around Hyderabad. Click a marker —
  every panel follows the selected station.
- Telemetry: temperature, humidity, pressure charts from stored history
  (survives refresh) plus live polls. Point at the observation time vs
  fetch time: "Upstream data updates on model runs, so we show when the
  observation was actually made, not when we fetched it."
- If a station shows an anomaly, click through to it. If all are healthy,
  say so and move on — the simulation is where faults appear on demand.

## Minute 2–3 — Simulation Lab (the core demo)

- Open `/app/simulate`. Select the central station.
- Run **Official 55 °C example**. Narrate the trace:
  - Range rule PASSES — 55 °C is exactly on the boundary.
  - Spatial check FAILS — 55 °C vs ~28 °C neighbours, 27 °C difference.
  - "That is the PS 73 example working as designed: a lone 55 °C reading
    while neighbours are normal is a sensor fault, not weather."
  - Repair: spatial weighted average replaces the value; the before/after
    chart shows raw vs repaired.
- Run **Frozen sensor** (6 steps): identical readings across distinct
  observation times trip the flatline rule. Mention the 30-minute span
  guard — stable weather does not false-alarm.
- Note the labels: every injected reading says "Simulated", and "Not
  persisted to live records".

## Minute 3–4 — Anomaly Intelligence + Sensor Health

- Open `/app/anomalies`: the alert history from real stored rows. Open one
  alert: what was detected, why it was suspicious, which methods fired,
  before/after values, how the repair was calculated, and the evidence
  score — "a heuristic, not a model probability; the LSTM is a forecaster,
  not a classifier, and we do not pretend otherwise."
- Open `/app/health`: per-station health scores and maintenance priority,
  with the formula shown on the page.

## Minute 4–5 — Model Performance + Architecture

- Open `/app/evaluation`: precision/recall/F1 and the confusion matrix,
  computed live by a seeded harness over labelled synthetic faults.
  "Drift recall is 0.0 — we have no drift detector yet, and the dashboard
  says so instead of hiding it. That is next."
- Open `/app/architecture`: one diagram, data flow end to end.
- Close: "Everything you saw ran live: real Open-Meteo data, the real
  rule + spatial + LSTM pipeline, and metrics computed on the spot — not
  screenshots, not hardcoded."

## If something fails live

- **Live panels show an error**: Open-Meteo quota or network. Say it,
  show the error state working as designed, continue on stored data.
- **Simulation 502s**: same cause. Show the seeded alert history instead
  and describe the simulation flow.
- **Backend down**: `uvicorn main:app` from `backend/`; check
  `/api/v1/health`.
