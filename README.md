# SkyGuard AI — Intelligent Weather Sensor Anomaly Detection & Repair

SIH 2026 · Problem Statement SIH26073 · Ministry of Earth Sciences / India
Meteorological Department · Disaster Management theme

SkyGuard monitors Automatic Weather Station (AWS) observations, detects
suspicious readings, explains the likely sensor fault, and repairs the data
— in real time. It answers one question: **is this a real weather event, or
a broken sensor?**

- **Live data**: real Open-Meteo observations (temperature, pressure,
  humidity) for a network of 6 virtual stations.
- **Hybrid detection**: physical range rules + frozen-sensor detection +
  spatial KNN consistency + ONNX LSTM repair.
- **Explainable**: every alert carries severity, root-cause hypothesis,
  contributing detection methods, and a labelled heuristic evidence score.
- **Simulation Lab**: inject spikes, frozen sensors, drift, dropouts, and
  the official 55 °C example through the real pipeline — without touching
  live records.
- **Honest evaluation**: precision/recall/F1 computed by a seeded harness
  over labelled synthetic faults. No hardcoded scores.

## Honesty notes (read before demoing)

- The 6 stations are **virtual monitoring nodes** in a 40 km ring around a
  centre point, each fed by live Open-Meteo data for its coordinates. They
  are **not real IMD stations**, and the UI says so.
- The ONNX LSTM was trained on **90 days of synthetic sine-wave data**
  (`backend/train_lstm.py`, seed 42), not on real historical AWS data. It
  is a forecaster used for repair, not a classifier — SkyGuard reports no
  model probabilities. Evidence scores are documented heuristics.
- The pipeline has **no drift detector yet**; the evaluation harness
  reports drift recall as 0.0 rather than hiding it.
- Simulated observations are always labelled and never written to the
  observations table.

## Architecture

```
Open-Meteo API ──► Virtual station network (6 nodes, 40 km ring)
                        │
                        ▼
              FastAPI backend (Python)
                ├─ Rule engine (range + frozen-sensor)
                ├─ Spatial KNN (50 km, 5 °C threshold)
                ├─ ONNX LSTM (12-step repair forecast)
                ├─ Repair engine (spatial avg / LSTM / clamp)
                └─ SQLite (distinct observations only)
                        │
                        ▼
              React 19 + Vite dashboard
```

Key design decision — **freshness-aware ingestion**: Open-Meteo `current`
values update on model runs, not per request. SkyGuard dedupes on
`(station_id, observed_at)`, so a re-fetch of the same upstream
observation is not stored as a new measurement, and the frozen-sensor rule
only fires on identical values spanning ≥ 30 minutes of distinct
observations. See `docs/phase0-flatline-observation.md` for the full
record, including the two real bugs this work found (repaired values
masking a frozen sensor; the flatline rule judging the whole history
window instead of the recent window).

## Project structure

```
frontend/               React 19 + Vite + Tailwind CSS v4 + Recharts + Leaflet
  src/
    pages/              Landing, CommandCenter, Anomalies, SimulationLab,
                        SensorHealth, Evaluation, Architecture
    components/         ui/ layout/ dashboard/ anomalies/ simulation/
    hooks/ services/    Shared polling, typed API client
backend/                FastAPI + SQLAlchemy (async) + SQLite + ONNX Runtime
  app/api/              routes.py (live/repair), extended.py (history/alerts/
                        simulate/health/evaluation)
  app/engine/           rule_checker, knn_checker, lstm_model, repair_engine,
                        pipeline (shared), explain, freshness, evaluation
  app/models/           Observation (raw + repaired values, observed_at)
  models_store/         lstm_v1.onnx + scaler.pkl
  scripts/              observe_flatline.py, seed_demo_db.py
  tests/                pytest: engines + API (stubbed fetcher)
docs/                   api-contract.md, phase0-flatline-observation.md,
                        demo-walkthrough.md
```

API reference: [`docs/api-contract.md`](docs/api-contract.md).

## Prerequisites

- Python 3.11+ (3.12 verified)
- Node.js 20+ (v24 verified)

## Quick start

**Backend** (terminal 1):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-runtime.txt
uvicorn main:app --host 127.0.0.1 --port 8000
# → http://127.0.0.1:8000/api/v1/health
```

No `torch` needed to run the server — inference goes through ONNX
Runtime. `requirements.txt` adds `torch` + `pandas` for retraining only
(`python train_lstm.py`).

**Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173 (API proxied to :8000)
```

Production build: `npm run build` (output in `frontend/dist/`).

## Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `SKYGUARD_DB_PATH` | backend | `backend/skyguard.db` | SQLite file (tests + demo DB use this) |
| `VITE_API_BASE_URL` | frontend | `/api/v1` | Backend origin + prefix in production, e.g. `https://api.example.com/api/v1` |

## Development commands

```bash
# Backend tests (19 tests, stubbed fetcher, scratch DB — no network needed)
cd backend && pip install -r requirements-dev.txt && python -m pytest tests/ -q

# Frontend checks
cd frontend && npm run build && npm run lint

# Seed a labelled-synthetic demo DB for UI work (never live data)
python backend/scripts/seed_demo_db.py
SKYGUARD_DB_PATH=backend/demo.db uvicorn main:app --port 8000   # from backend/
```

## Simulation instructions

Open **Simulation Lab** (`/app/simulate`), pick a station and a scenario,
preview it, and run it. Each step goes through the real detection +
repair pipeline on a live Open-Meteo baseline; results are labelled
simulated and never persisted. Scenarios: temperature spike, frozen
sensor, gradual drift, sensor dropout (gap analysis), the official 55 °C
example, and custom injection (station / parameter / value / steps).

The 55 °C example is the interesting one: 55 °C sits exactly on the range
boundary, so the range rule passes and only the spatial check (55 °C vs
~28 °C neighbours) catches it — which is the point of the PS 73 example.

## Deployment

- **Frontend → Vercel**: import the repo, set Root Directory to
  `frontend`, framework preset Vite, and `VITE_API_BASE_URL` to the
  backend URL + `/api/v1`. No config file needed.
- **Backend → Render / Railway / any container host**: `backend/Dockerfile`
  is provided (`render.yaml` pins the Render service). The backend needs
  no environment variables for a basic deploy.
- **Caveat**: the backend uses SQLite, which is ephemeral on most free
  hosts — stored history resets on redeploy. The live pipeline, simulation
  and evaluation are unaffected. For persistent history, point
  `SKYGUARD_DB_PATH` at a persistent volume or migrate to Postgres.

## Open-Meteo quota

The free Open-Meteo tier allows 10k calls/day per IP. SkyGuard caches
upstream responses for 10 minutes per coordinate pair and polls every
30 s, so one demo uses ~900 calls/day. On a shared-venue IP the quota can
still be exhausted — if the live endpoint returns 502, the dashboard shows
an error state (never fake data), and history/alerts/health/evaluation
keep working from stored data.

## Known limitations

- LSTM trained on synthetic sine-wave data; trained on hourly steps but
  live observations arrive per upstream model run (timescale mismatch —
  the 12-step window spans hours live, not minutes).
- LSTM repair needs a full 12-step window of distinct observations and
  only runs on already-flagged readings.
- No drift detector yet (evaluation reports drift recall 0.0).
- No WebSocket/SSE streaming; the frontend polls every 30 s.
- No authentication; the API is open by design for the SIH demo.
- Single-commit history: the original repo was one commit (fa727fa); the
  rebuild adds phased commits on top. Generated files (`.venv`,
  `skyguard.db`, `__pycache__`) were untracked without rewriting history,
  so they still exist in the original commit.

## SIH demo

See [`docs/demo-walkthrough.md`](docs/demo-walkthrough.md) for the
5-minute scripted walkthrough.
