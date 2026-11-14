"""Explainability helpers: severity, root-cause labels and evidence scores.

Everything here is a *documented heuristic* over the signals the detection
pipeline actually produces. Nothing here is a model probability — the LSTM
is a forecaster, not a classifier, so no calibrated anomaly probability
exists. The frontend must label the evidence score as a heuristic.
"""

from __future__ import annotations

from typing import Any

# Evidence-score weights. Deliberately transparent: the score is the sum of
# the signals that fired, capped at 95. See README "Evidence score".
_EVIDENCE_WEIGHTS = {
    "range_violation": 45,
    "flatline": 30,
    "spatial": 30,
    "lstm_repair": 15,
    "spatial_repair": 10,
}


def root_cause_for(flag_reason: str) -> dict[str, str]:
    """Map a pipeline flag reason to a stable root-cause category."""
    reason = (flag_reason or "").upper()
    if "SPATIAL" in reason:
        return {
            "category": "spatial_inconsistency",
            "label": "Spatial inconsistency",
            "explanation": (
                "This reading disagrees with nearby stations measuring the "
                "same weather. A real weather event moves all neighbours "
                "together; a lone outlier points at the sensor."
            ),
        }
    if "FLATLINE" in reason or "FROZEN" in reason:
        return {
            "category": "stuck_sensor",
            "label": "Stuck sensor",
            "explanation": (
                "The sensor reported the identical value across several "
                "distinct observation times. Real weather drifts; a frozen "
                "value means the sensor stopped sampling."
            ),
        }
    if "OUT OF VALID RANGE" in reason:
        return {
            "category": "range_violation",
            "label": "Out of physical range",
            "explanation": (
                "The value is outside the physically plausible range for "
                "this parameter, so it cannot be a real measurement."
            ),
        }
    return {
        "category": "unknown",
        "label": "Unclassified",
        "explanation": "The pipeline flagged this reading without a specific cause.",
    }


def severity_for(flag_reason: str, qc_flag: str) -> str:
    """Severity is a triage label, not a measurement: high / medium / low."""
    if qc_flag == "GOOD":
        return "low"
    cause = root_cause_for(flag_reason)["category"]
    if cause in ("range_violation", "spatial_inconsistency"):
        return "high"
    if cause == "stuck_sensor":
        return "medium"
    return "medium"


def evidence_score(
    flag_reason: str,
    repair_method: str | None = None,
    lstm_predicted: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Heuristic evidence score (0-100) with its contributing signals.

    The score answers "how much independent evidence supports this flag?"
    It is NOT a probability and must be displayed with that label.
    """
    reason = (flag_reason or "").upper()
    signals: list[str] = []
    score = 0
    if "OUT OF VALID RANGE" in reason:
        signals.append("range_violation")
        score += _EVIDENCE_WEIGHTS["range_violation"]
    if "FLATLINE" in reason or "FROZEN" in reason:
        signals.append("flatline")
        score += _EVIDENCE_WEIGHTS["flatline"]
    if "SPATIAL" in reason:
        signals.append("spatial")
        score += _EVIDENCE_WEIGHTS["spatial"]
    if lstm_predicted is not None:
        signals.append("lstm_repair")
        score += _EVIDENCE_WEIGHTS["lstm_repair"]
    elif (repair_method or "") == "SPATIAL_KNN_WEIGHTED_AVERAGE":
        signals.append("spatial_repair")
        score += _EVIDENCE_WEIGHTS["spatial_repair"]
    score = max(30, min(95, score)) if signals else 0
    return {
        "score": score,
        "method": "heuristic",
        "signals": signals,
        "note": (
            "Heuristic evidence score, not a model probability. "
            "Higher means more independent pipeline signals agree."
        ),
    }
