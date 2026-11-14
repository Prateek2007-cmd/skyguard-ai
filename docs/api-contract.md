# SkyGuard API contract (frontend ↔ FastAPI)

Base URL in dev: `/api/v1` (Vite proxies `/api` → `http://127.0.0.1:8000`).
In production set `VITE_API_BASE_URL` to the backend origin + `/api/v1`.

All timestamps are ISO strings. All temperatures °C, pressure hPa,
humidity %RH.

## GET /health

```json
{"status": "online", "onnx_lstm_ready": true, "database": "connected"}
```

## GET /live-surrounding-stations?lat=17.385&lon=78.4866&count=6

Live readings for 6 VIRTUAL stations in a 40 km ring around the centre
point. Values are real Open-Meteo data; the stations are virtual nodes,
not IMD stations — the UI must say so.

Returns 502 when Open-Meteo is unreachable or rate-limited. The UI must
show a proper error state, not fake data.

```json
{"stations": [StationReading]}
```

`StationReading`:
```json
{
  "station_id": "AWS_CENTER_0", "name": "Central AWS Node",
  "latitude": 17.385, "longitude": 78.4866,
  "temperature": 28.4, "pressure": 1012.1, "humidity": 61.0,
  "raw_temperature": 28.4, "raw_pressure": 1012.1, "raw_humidity": 61.0,
  "repaired_temperature": 28.4,
  "has_anomaly": false, "qc_flag": "GOOD",
  "flag_reason": "All basic rule checks passed",
  "repair_method": "NONE",
  "observed_at": "2026-11-14T12:00",
  "fetched_at": "2026-11-14T12:00:31.123456+00:00",
  "is_duplicate": false,
  "timestamp": "2026-11-14T12:00:31.123456+00:00"
}
```

- `temperature`/`pressure`/`humidity` are the REPAIRED (final) values.
- `observed_at` is the upstream observation time; `fetched_at` is when
  SkyGuard fetched it. `observed_at` is UTC (naive ISO, no offset) — the
  fetcher requests `timezone=UTC` from Open-Meteo, and every consumer
  parses naive timestamps as UTC. When `is_duplicate` is true the upstream
  observation has not changed since the last poll — show the observation
  time, not the fetch time, as "last updated".
- `repair_method`: `NONE` | `SPATIAL_KNN_WEIGHTED_AVERAGE` |
  `LSTM_ONNX_INFERENCE` | `PHYSICAL_LIMIT_CLAMP`.

## POST /anomalies/repair

Body: `{station_id, latitude, longitude, temperature, pressure, humidity}`.
Re-runs the pipeline on the supplied reading and stores the result.
Returns `{"observation": StationReading}`.

## GET /stations/{station_id}/history?limit=120

Stored DISTINCT observations, oldest first (chart order). Same fields as
`StationReading` plus `id`. `limit` 1–500.

```json
{"station_id": "AWS_CENTER_0", "observations": [StationReading]}
```

## GET /alerts?station_id=&severity=&limit=50&offset=0

Flagged observations (`qc_flag != GOOD`), newest first. `severity` is
`low` | `medium` | `high` (derived triage label).

```json
{"alerts": [Alert], "total": 3, "limit": 50, "offset": 0}
```

`Alert` = `StationReading` +:
```json
{
  "severity": "high",
  "root_cause": {
    "category": "spatial_inconsistency",
    "label": "Spatial inconsistency",
    "explanation": "..."
  },
  "evidence": {
    "score": 40, "method": "heuristic",
    "signals": ["spatial", "spatial_repair"],
    "note": "Heuristic evidence score, not a model probability. ..."
  }
}
```

`root_cause.category`: `range_violation` | `stuck_sensor` |
`spatial_inconsistency` | `unknown`. The evidence score MUST be labelled
"Heuristic evidence score" in the UI — never a probability or confidence %.

## GET /alerts/{alert_id}

`Alert` + `rule_results` (`[{rule, passed, detail}]`), `detection_methods`
(`["Temperature", "Spatial KNN"]`), `before_after` (`{raw: {temperature,
pressure, humidity}, repaired: {...}}`), `repair_explanation` (string).

## POST /simulate

Body:
```json
{
  "station_id": "AWS_CENTER_0", "latitude": 17.385, "longitude": 78.4866,
  "scenario": "spike|frozen|drift|dropout|official55|custom",
  "parameter": "temperature", "value": 47.0, "steps": 6
}
```

- `spike`: one step, `value` or baseline+15 °C.
- `frozen`: `steps` identical readings.
- `drift`: `steps` readings drifting +1.2 °C/step.
- `dropout`: no steps; returns `gap_analysis` instead.
- `official55`: one step, 55 °C / 95 % / 985 hPa (the PS 73 example).
- `custom`: one step, `parameter` = `value` (value required).

The baseline and spatial neighbours are LIVE Open-Meteo data; each step
runs through the real pipeline. Nothing is persisted
(`simulated: true, persisted: false` — show both labels in the UI).

Response:
```json
{
  "simulated": true, "persisted": false,
  "station_id": "AWS_CENTER_0", "scenario": "spike",
  "baseline": {"temperature": 28.4, "pressure": 1012.1, "humidity": 61.0,
               "observed_at": "2026-11-14T12:00"},
  "steps": [{
    "step": 1, "simulated": true,
    "injected": {"temperature": 47.0, "pressure": 1012.1, "humidity": 61.0},
    "qc_flag": "FAULTY", "flag_reason": "SPATIAL_ANOMALY: ...",
    "has_anomaly": true,
    "rule_results": [{"rule": "Temperature", "passed": true, "detail": "..."}],
    "spatial": {"checked": true, "anomaly": true, "reason": "...",
                "neighbour_avg": 28.4, "neighbour_count": 5, "diff_c": 18.6},
    "lstm": {"available": true, "ran": false,
             "reason": "LSTM needs a full 12-step ... window; only 3 available.",
             "prediction": null},
    "repaired": {"temperature": 28.4, "pressure": 1012.1, "humidity": 61.0},
    "repair_method": "SPATIAL_KNN_WEIGHTED_AVERAGE",
    "evidence": {"score": 40, "method": "heuristic", "signals": [...], "note": "..."}
  }],
  "summary": {"detected": true, "steps_flagged": 1, "steps_total": 1,
              "message": "1 of 1 injected steps flagged."}
}
```

Dropout response replaces `steps` with `gap_analysis`:
```json
{"is_stale": false, "gap_minutes": 42.0, "reason": "...",
 "explanation": "A dropout is the absence of a reading, ..."}
```

## GET /health/summary

```json
{
  "stations": [{
    "station_id": "AWS_CENTER_0", "readings": 36, "anomalies": 1,
    "anomaly_rate": 0.0278,
    "last_observed_at": "2026-11-14T06:00:00+00:00",
    "last_ingested_at": "2026-11-14T06:02:00+00:00",
    "freshness": {"is_stale": false, "gap_minutes": 42.0, "reason": "..."},
    "longest_repeated_run": 5,
    "per_parameter_anomalies": {"temperature": 1, "pressure": 0,
                                "humidity": 0, "spatial": 0},
    "health_score": 89, "maintenance_priority": "medium"
  }],
  "stations_observed": 6,
  "method": {"health_score": "100 - 50*anomaly_rate - ...",
             "maintenance_priority": "high if ...",
             "stale_threshold_minutes": 120}
}
```

Show the `method` text in the UI: the score is a documented heuristic,
not a failure prediction.

## GET /evaluation?seed=42&n_cases=240

Computed (never hardcoded) metrics from a seeded SYNTHETIC labelled set
run through the real checkers.

```json
{
  "dataset": {"labelled": "synthetic", "seed": 42, "total_cases": 240,
              "composition": {"normal": 127, "spike": 34, "range": 22,
                              "frozen": 22, "spatial": 22, "drift": 13},
              "generated_by": "..."},
  "metrics": {"precision": 1.0, "recall": 0.885, "f1": 0.939,
              "false_alarm_rate": 0.0, "accuracy": 0.9458},
  "confusion": {"tp": 100, "fp": 0, "tn": 127, "fn": 13},
  "per_fault_recall": {"spike": 1.0, "range": 1.0, "frozen": 1.0,
                       "spatial": 1.0, "drift": 0.0},
  "per_method": {"rule_only": {...}, "rule_plus_spatial": {...}},
  "freshness": {"cases": 20, "correct": 20, "accuracy": 1.0,
                "method": "Gap > 120 min since last distinct observation."},
  "false_positives": [{"case_id": 3, "temperature": 31.2, "reason": "..."}],
  "false_negatives": [{"case_id": 9, "fault": "drift", "temperature": 30.1,
                       "reason": "No rule or spatial check triggered."}],
  "limitations": ["Synthetic faults only — ...",
                  "Drift recall is expected to be low: ...",
                  "The ONNX LSTM is not scored here: ..."]
}
```

The UI MUST label the dataset as synthetic and show the limitations.
Reference values above are from seed 42 / 240 cases — the UI must fetch
live values, never hardcode them.

## Local development without Open-Meteo quota

Open-Meteo's free tier is per egress IP and can be exhausted on shared
networks. For UI work, run the backend on the seeded SYNTHETIC demo DB:

```bash
SKYGUARD_DB_PATH=backend/demo.db uvicorn main:app --port 8000
# (regenerate with: python backend/scripts/seed_demo_db.py)
```

History/alerts/health/evaluation work fully on the demo DB. The live and
simulate endpoints need Open-Meteo and return 502 when it is unavailable —
the UI must handle that as an error state.
