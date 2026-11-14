# Phase 0 — flatline observation record

Date: 2026-11-14. Observer: automated run, `backend/scripts/observe_flatline.py`.

## Hypothesis

Open-Meteo `current` values update on model runs, not per request, while the
app polls every 30 s and stores one row per poll. Four or more identical
consecutive stored readings would trip the "sensor frozen" (flatline) rule,
so the dashboard could show every station faulty within minutes — for the
wrong reason.

## Live run: NOT COMPLETED (environment limit)

The 5-minute live observation (10 polls × 30 s, fresh DB, original code)
could not run: **every Open-Meteo request from this VM returned HTTP 429
`{"reason": "Daily API request limit exceeded. Please try again tomorrow."}`**.
The VM's shared egress IP had exhausted Open-Meteo's free daily quota
(10k calls/day/IP). The backend answered `/health` correctly throughout and
the live endpoint correctly returned 502 upstream errors; no poll produced
usable data. Raw log: `docs/phase0-observation.jsonl` (5 polls, all
`upstream_error 429` / `api_error 502`, run stopped early).

**The hypothesis was therefore NOT verified against live Open-Meteo data.**
It was verified instead against a stubbed fetcher (see below), which
reproduces the slow-upstream behaviour deterministically.

## What the 429 finding changed

1. **Upstream response cache** (`external_fetcher.py`): responses are now
   cached per coordinate pair for 10 minutes. Upstream values change slowly
   anyway, so this cuts quota use ~20× at 30 s polling and keeps the demo
   working on a shared-venue IP. The cached payload keeps its original
   upstream observation time.
2. **Demo seed script** (`backend/scripts/seed_demo_db.py`): generates a
   clearly-labelled SYNTHETIC demo database through the real pipeline, so
   history/alerts/health pages can be exercised without live upstream data.

## Fix implemented (freshness-aware ingestion)

- `external_fetcher.py` returns the upstream observation timestamp
  (`current.time`) as `observed_at`.
- `routes.py` dedupes on `(station_id, observed_at)`: a re-fetch of the
  same upstream observation returns the stored result with
  `is_duplicate: true` and inserts no row.
- `rule_checker.py` flatline rule now requires the identical values to span
  ≥ 30 minutes of distinct observation times (in addition to ≥ 4 readings).
  Frozen-sensor detection is NOT disabled.
- Raw values are now stored alongside repaired values
  (`raw_temperature` / `raw_pressure` / `raw_humidity`), and the rule
  checkers judge the RAW series. Previously the flatline check ran on
  repaired values, so a repaired stuck sensor stopped being flagged — the
  repair masked the fault it had just fixed. Found by
  `test_lstm_repair_runs_with_a_full_window` during this phase.
- Flatline window bug fixed: the original check compared the WHOLE history
  window (12 rows live), so a sensor that varied for hours and then froze
  was never flagged. The rule now judges the last 4 distinct observations
  plus the current reading, matching its documented intent ("4+ identical
  consecutive readings"). Regression test:
  `test_flatline_looks_at_the_recent_window_not_all_history`. Found while
  verifying the demo seed script.

## Verification (stubbed fetcher, deterministic)

`backend/tests/test_api.py` drives the real HTTP endpoints with a stub
fetcher whose upstream clock the test controls:

- Same upstream observation re-fetched → `is_duplicate: true`, row count
  stays 1 (`test_duplicate_observation_is_not_stored_twice`).
- Five distinct upstream observations, identical values, 15 min apart →
  `FAULTY` flatline (`test_flatline_flags_only_after_distinct_observations`).
- Twelve distinct observations then an anomalous poll → LSTM repair runs
  (`test_lstm_repair_runs_with_a_full_window`).

Full backend suite: **17 passed** (`pytest tests/`, 2026-11-14).

## Remaining

Re-run the 5-minute live observation from a network whose IP still has
Open-Meteo quota (e.g. the demo laptop) before the SIH demo, to confirm the
fix against real upstream cadence.
