"""Extended SkyGuard API: history, alerts, simulation, health, evaluation.

These endpoints were added in the Phase 2-4 rebuild. They read the same
observations table the live pipeline writes; the simulation endpoint is the
only one that runs the pipeline without persisting anything.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any
from urllib.error import URLError

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import (
    _fetch_weather_for_nodes,
    _surrounding_coordinates,
    lstm_engine,
    weather_fetcher,
)
from app.core.database import get_db
from app.engine.evaluation import run_evaluation
from app.engine.explain import evidence_score, root_cause_for, severity_for
from app.engine.freshness import check_freshness
from app.engine.pipeline import run_detection_pipeline
from app.engine.rule_checker import RuleChecker
from app.models.observation import Observation

router = APIRouter(prefix="/api/v1")

_rule_checker = RuleChecker()


# --------------------------------------------------------------------------
# Shared serializers
# --------------------------------------------------------------------------

def _history_row(obs: Observation) -> dict[str, Any]:
    return {
        "id": obs.id,
        "station_id": obs.station_id,
        "timestamp": obs.timestamp.isoformat() if obs.timestamp else None,
        "observed_at": obs.observed_at,
        "temperature": obs.temperature,
        "pressure": obs.pressure,
        "humidity": obs.humidity,
        "raw_temperature": obs.raw_temperature,
        "raw_pressure": obs.raw_pressure,
        "raw_humidity": obs.raw_humidity,
        "repaired_temperature": obs.repaired_temperature,
        "repair_method": obs.repair_method,
        "qc_flag": obs.qc_flag,
        "flag_reason": obs.flag_reason,
        "has_anomaly": obs.qc_flag != "GOOD",
    }


def _alert_row(obs: Observation) -> dict[str, Any]:
    cause = root_cause_for(obs.flag_reason or "")
    return {
        **_history_row(obs),
        "severity": severity_for(obs.flag_reason or "", obs.qc_flag),
        "root_cause": cause,
        "evidence": evidence_score(
            obs.flag_reason or "", repair_method=obs.repair_method
        ),
    }


async def _history_dicts(
    station_id: str, db: AsyncSession, limit: int = 12, use_raw: bool = False
) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Observation)
        .where(Observation.station_id == station_id)
        .order_by(Observation.timestamp.desc())
        .limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    out = []
    for row in rows:
        if use_raw:
            out.append({
                "temperature": row.raw_temperature if row.raw_temperature is not None else row.temperature,
                "pressure": row.raw_pressure if row.raw_pressure is not None else row.pressure,
                "humidity": row.raw_humidity if row.raw_humidity is not None else row.humidity,
                "observed_at": row.observed_at,
            })
        else:
            out.append({
                "temperature": row.temperature,
                "pressure": row.pressure,
                "humidity": row.humidity,
                "observed_at": row.observed_at,
            })
    return out


# --------------------------------------------------------------------------
# History
# --------------------------------------------------------------------------

@router.get("/stations/{station_id}/history")
async def get_station_history(
    station_id: str,
    limit: int = Query(120, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Stored observations for one station, oldest first (chart order).

    Only distinct upstream observations are stored (see the freshness-aware
    ingestion fix), so this is the true observation history, not poll copies.
    """
    result = await db.execute(
        select(Observation)
        .where(Observation.station_id == station_id)
        .order_by(Observation.timestamp.desc())
        .limit(limit)
    )
    rows = list(reversed(result.scalars().all()))
    return {"station_id": station_id, "observations": [_history_row(r) for r in rows]}


# --------------------------------------------------------------------------
# Alerts
# --------------------------------------------------------------------------

@router.get("/alerts")
async def list_alerts(
    station_id: str | None = None,
    severity: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Alert history: stored observations flagged FAULTY/SUSPECT, newest
    first. Severity is a derived triage label (see explain.py)."""
    query = select(Observation).where(Observation.qc_flag != "GOOD")
    if station_id:
        query = query.where(Observation.station_id == station_id)
    query = query.order_by(Observation.timestamp.desc())
    rows = (await db.execute(query)).scalars().all()
    alerts = [_alert_row(row) for row in rows]
    if severity:
        alerts = [a for a in alerts if a["severity"] == severity.lower()]
    total = len(alerts)
    return {
        "alerts": alerts[offset:offset + limit],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/alerts/{alert_id}")
async def get_alert_detail(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """One alert with a recomputed rule breakdown.

    The per-rule verdicts are recomputed from the stored RAW reading and
    the 12 observations preceding it, so the explanation reflects the same
    checks that ran live. Spatial evidence cannot be recomputed (neighbour
    readings are not stored) and is reported from the original flag reason.
    """
    alert = (
        await db.execute(
            select(Observation).where(Observation.id == alert_id)
        )
    ).scalars().first()
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found.")

    prior = await db.execute(
        select(Observation)
        .where(Observation.station_id == alert.station_id)
        .where(Observation.timestamp < alert.timestamp)
        .order_by(Observation.timestamp.desc())
        .limit(12)
    )
    prior_rows = list(reversed(prior.scalars().all()))
    # Rule verdicts are recomputed against the RAW series: what the sensor
    # reported, not what a previous repair wrote.
    history = [
        {
            "temperature": row.raw_temperature if row.raw_temperature is not None else row.temperature,
            "pressure": row.raw_pressure if row.raw_pressure is not None else row.pressure,
            "humidity": row.raw_humidity if row.raw_humidity is not None else row.humidity,
            "observed_at": row.observed_at,
        }
        for row in prior_rows
    ]
    raw_reading = {
        "temperature": alert.raw_temperature if alert.raw_temperature is not None else alert.temperature,
        "pressure": alert.raw_pressure if alert.raw_pressure is not None else alert.pressure,
        "humidity": alert.raw_humidity if alert.raw_humidity is not None else alert.humidity,
    }
    rule_results = _rule_checker.check_reading_detailed(raw_reading, history)
    cause = root_cause_for(alert.flag_reason or "")
    repair_explanation = {
        "SPATIAL_KNN_WEIGHTED_AVERAGE": (
            "Replacement temperature is the inverse-distance-weighted mean "
            "of nearby stations' readings."
        ),
        "LSTM_ONNX_INFERENCE": (
            "Replacement values are the ONNX LSTM's one-step-ahead forecast "
            "from the previous 12 distinct observations."
        ),
        "PHYSICAL_LIMIT_CLAMP": (
            "Replacement values are the raw values clamped to their physical "
            "ranges — a last-resort repair when no better estimate exists."
        ),
        "NONE": "No repair was applied to this reading.",
    }.get(alert.repair_method or "NONE", "No repair information stored.")

    return {
        **_alert_row(alert),
        "rule_results": rule_results,
        "detection_methods": [
            result["rule"] for result in rule_results if not result["passed"]
        ] + (
            ["Spatial KNN"] if "SPATIAL" in (alert.flag_reason or "").upper() else []
        ),
        "before_after": {
            "raw": raw_reading,
            "repaired": {
                "temperature": alert.temperature,
                "pressure": alert.pressure,
                "humidity": alert.humidity,
            },
        },
        "repair_explanation": repair_explanation,
        "root_cause": cause,
    }


# --------------------------------------------------------------------------
# Simulation Lab
# --------------------------------------------------------------------------

class SimulateRequest(BaseModel):
    station_id: str = Field(min_length=1)
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    scenario: str = Field(
        pattern="^(spike|frozen|drift|dropout|official55|custom)$"
    )
    parameter: str = Field(default="temperature",
                           pattern="^(temperature|pressure|humidity)$")
    value: float | None = Field(default=None, allow_inf_nan=False)
    steps: int = Field(default=6, ge=2, le=12)


def _scenario_steps(request: SimulateRequest, baseline: dict[str, Any]) -> list[dict[str, Any]]:
    """Build the injected readings for a scenario from the live baseline.

    Every injected value is derived from the real current reading, and every
    step is labelled simulated in the response. Nothing here is persisted.
    """
    base = {
        "temperature": baseline["temperature"],
        "pressure": baseline["pressure"],
        "humidity": baseline["humidity"],
        "latitude": request.latitude,
        "longitude": request.longitude,
    }
    scenario = request.scenario
    if scenario == "spike":
        step = dict(base)
        step["temperature"] = request.value if request.value is not None else round(base["temperature"] + 15.0, 2)
        return [step]
    if scenario == "official55":
        # The PS 73 worked example: 55 C with high humidity and abnormal
        # pressure while neighbours stay normal. 55 C sits exactly on the
        # range boundary, so the range rule passes and only the spatial
        # check can catch it — that is the point of the example.
        step = dict(base)
        step.update({"temperature": 55.0, "humidity": 95.0, "pressure": 985.0})
        return [step]
    if scenario == "custom":
        step = dict(base)
        if request.value is None:
            raise HTTPException(
                status_code=422, detail="Custom injection requires a value."
            )
        step[request.parameter] = request.value
        return [step]
    if scenario == "frozen":
        return [dict(base) for _ in range(request.steps)]
    if scenario == "drift":
        steps = []
        for index in range(1, request.steps + 1):
            step = dict(base)
            step["temperature"] = round(base["temperature"] + 1.2 * index, 2)
            steps.append(step)
        return steps
    return []  # dropout has no injected readings; see gap analysis below


@router.post("/simulate")
async def run_simulation(
    request: SimulateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Run an injected fault through the REAL detection + repair pipeline.

    The baseline and the spatial neighbours are live Open-Meteo data; the
    injected steps are evaluated by the same pipeline code as live readings.
    Results are never written to the observations table.
    """
    # Validate before any upstream fetch, so a bad request is a 422 even
    # when Open-Meteo is down.
    if request.scenario == "custom" and request.value is None:
        raise HTTPException(
            status_code=422, detail="Custom injection requires a value."
        )
    try:
        baseline = await asyncio.to_thread(
            weather_fetcher.fetch_live_station_data,
            request.latitude,
            request.longitude,
            request.station_id,
        )
    except (URLError, ValueError, OSError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Open-Meteo did not return valid station data: {exc}",
        ) from exc
    neighbour_nodes = _surrounding_coordinates(
        request.latitude, request.longitude, count=6
    )[1:]
    neighbours = await _fetch_weather_for_nodes(neighbour_nodes)
    stored_history = await _history_dicts(request.station_id, db, use_raw=True)
    stored_lstm_history = await _history_dicts(request.station_id, db, use_raw=False)

    if request.scenario == "dropout":
        last_observed = None
        if stored_history:
            last_observed = stored_history[-1].get("observed_at")
        freshness = check_freshness(last_observed)
        return {
            "simulated": True,
            "persisted": False,
            "station_id": request.station_id,
            "scenario": "dropout",
            "baseline": baseline,
            "steps": [],
            "gap_analysis": {
                **freshness,
                "explanation": (
                    "A dropout is the absence of a reading, so there is "
                    "nothing for the value checkers to judge. SkyGuard "
                    "detects it as a freshness gap: if no distinct upstream "
                    "observation arrives within the threshold, the station "
                    "is flagged stale in Sensor Health."
                ),
            },
            "summary": {
                "detected": freshness["is_stale"],
                "message": (
                    "Station is currently stale."
                    if freshness["is_stale"]
                    else "Station is reporting normally; a dropout would "
                         "appear here as a freshness gap."
                ),
            },
        }

    injected = _scenario_steps(request, baseline)
    running_history = list(stored_history)
    running_lstm_history = list(stored_lstm_history)
    steps: list[dict[str, Any]] = []
    flagged = 0
    for index, reading in enumerate(injected, start=1):
        result = await asyncio.to_thread(
            run_detection_pipeline,
            reading,
            neighbours,
            running_history,
            lstm_engine,
            running_lstm_history,
        )
        if result["has_anomaly"]:
            flagged += 1
        steps.append({
            "step": index,
            "simulated": True,
            "injected": {
                "temperature": reading["temperature"],
                "pressure": reading["pressure"],
                "humidity": reading["humidity"],
            },
            "qc_flag": result["qc_flag"],
            "flag_reason": result["flag_reason"],
            "has_anomaly": result["has_anomaly"],
            "rule_results": result["rule_results"],
            "spatial": result["spatial"],
            "lstm": result["lstm"],
            "repaired": {
                "temperature": result["repaired"]["temperature"],
                "pressure": result["repaired"]["pressure"],
                "humidity": result["repaired"]["humidity"],
            },
            "repair_method": result["repair_method"],
            "evidence": evidence_score(
                result["flag_reason"],
                repair_method=result["repair_method"],
                lstm_predicted=result["lstm"]["prediction"],
            ),
        })
        # The rule history for the next injected step uses the RAW injected
        # values (what the sensor would have reported); the LSTM history
        # uses repaired values, mirroring the live path. Synthetic
        # observed_at values are spaced 15 minutes apart and marked as
        # simulated context, never stored.
        running_history.append({
            "temperature": reading["temperature"],
            "pressure": reading["pressure"],
            "humidity": reading["humidity"],
            "observed_at": None,
        })
        running_lstm_history.append({
            "temperature": result["repaired"]["temperature"],
            "pressure": result["repaired"]["pressure"],
            "humidity": result["repaired"]["humidity"],
            "observed_at": None,
        })
        running_history = running_history[-12:]
        running_lstm_history = running_lstm_history[-12:]

    return {
        "simulated": True,
        "persisted": False,
        "station_id": request.station_id,
        "scenario": request.scenario,
        "baseline": {
            "temperature": baseline["temperature"],
            "pressure": baseline["pressure"],
            "humidity": baseline["humidity"],
            "observed_at": baseline.get("observed_at"),
        },
        "steps": steps,
        "summary": {
            "detected": flagged > 0,
            "steps_flagged": flagged,
            "steps_total": len(steps),
            "message": (
                f"{flagged} of {len(steps)} injected steps flagged."
                if flagged else
                "No injected step was flagged — see the per-step trace for why."
            ),
        },
    }


# --------------------------------------------------------------------------
# Sensor health
# --------------------------------------------------------------------------

@router.get("/health/summary")
async def health_summary(
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Per-station health computed from stored observations only.

    The health score is a documented heuristic, not a prediction:
    score = 100 - 50*anomaly_rate - 25 (if stale) - 10 (if a repeated-value
    run of 4+ exists), floored at 0. Maintenance priority is a rule-based
    triage label derived from the same inputs. Stations with no stored
    observations are reported as "no data", never scored.
    """
    rows = (
        await db.execute(
            select(Observation).order_by(Observation.timestamp.asc())
        )
    ).scalars().all()

    by_station: dict[str, list[Observation]] = {}
    for row in rows:
        by_station.setdefault(row.station_id, []).append(row)

    now = datetime.now(timezone.utc)
    stations: list[dict[str, Any]] = []
    for station_id, obs in sorted(by_station.items()):
        total = len(obs)
        anomalies = [o for o in obs if o.qc_flag != "GOOD"]
        anomaly_rate = len(anomalies) / total if total else 0.0
        last = obs[-1]
        freshness = check_freshness(last.observed_at, now=now)

        # Longest run of identical consecutive temperatures (stuck-sensor
        # indicator) over the stored distinct observations.
        longest_run = 1
        current_run = 1
        for prev, cur in zip(obs, obs[1:]):
            if cur.temperature == prev.temperature:
                current_run += 1
                longest_run = max(longest_run, current_run)
            else:
                current_run = 1

        per_parameter = {"temperature": 0, "pressure": 0, "humidity": 0, "spatial": 0}
        for alert in anomalies:
            reason = (alert.flag_reason or "").upper()
            if "SPATIAL" in reason:
                per_parameter["spatial"] += 1
            if "TEMPERATURE" in reason or "FLATLINE" in reason:
                per_parameter["temperature"] += 1
            if "PRESSURE" in reason:
                per_parameter["pressure"] += 1
            if "HUMIDITY" in reason:
                per_parameter["humidity"] += 1

        score = 100 - round(50 * anomaly_rate)
        if freshness["is_stale"]:
            score -= 25
        if longest_run >= 4:
            score -= 10
        score = max(0, score)

        if freshness["is_stale"] or anomaly_rate > 0.25 or score < 50:
            priority = "high"
        elif anomaly_rate > 0.10 or longest_run >= 4 or score < 75:
            priority = "medium"
        else:
            priority = "low"

        stations.append({
            "station_id": station_id,
            "readings": total,
            "anomalies": len(anomalies),
            "anomaly_rate": round(anomaly_rate, 4),
            "last_observed_at": last.observed_at,
            "last_ingested_at": last.timestamp.isoformat() if last.timestamp else None,
            "freshness": freshness,
            "longest_repeated_run": longest_run,
            "per_parameter_anomalies": per_parameter,
            "health_score": score,
            "maintenance_priority": priority,
        })

    return {
        "stations": stations,
        "stations_observed": len(stations),
        "method": {
            "health_score": (
                "100 - 50*anomaly_rate - 25 if stale - 10 if a repeated-value "
                "run of 4+ exists, floored at 0. Heuristic triage, not a "
                "failure prediction."
            ),
            "maintenance_priority": (
                "high if stale, anomaly_rate > 0.25, or score < 50; medium "
                "if anomaly_rate > 0.10, repeated run >= 4, or score < 75; "
                "otherwise low."
            ),
            "stale_threshold_minutes": 120,
        },
    }


# --------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------

@router.get("/evaluation")
async def get_evaluation(
    seed: int = Query(42, ge=0),
    n_cases: int = Query(240, ge=50, le=1000),
) -> dict[str, Any]:
    """Run the seeded evaluation harness and return computed metrics."""
    return await asyncio.to_thread(run_evaluation, seed, n_cases)
