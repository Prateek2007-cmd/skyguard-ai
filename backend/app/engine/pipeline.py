"""Shared detection + repair pipeline (pure: no database access).

The live endpoint, the repair endpoint and the simulation endpoint all run
through this one function, so a simulated fault is judged by exactly the
same code as a live reading. Callers decide whether to persist the result —
simulation never does.
"""

from __future__ import annotations

from typing import Any

from app.engine.knn_checker import SpatialKNNChecker
from app.engine.repair_engine import SelfHealingPipeline
from app.engine.rule_checker import RuleChecker

rule_checker = RuleChecker()
spatial_checker = SpatialKNNChecker(max_distance_km=50.0)
repair_pipeline = SelfHealingPipeline()


def run_detection_pipeline(
    reading: dict[str, Any],
    neighbours: list[dict[str, Any]],
    history: list[dict[str, Any]],
    lstm_engine: Any | None = None,
    lstm_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Run rule checks, spatial validation, optional LSTM repair and the
    repair pipeline over one reading. Returns the full trace.

    `history` is the RAW sensor series: range and flatline rules must judge
    what the sensor actually reported, not what a previous repair wrote.
    `lstm_history` is the CLEAN (repaired) series the LSTM forecasts from;
    it defaults to `history` when the caller has only one series.
    """
    rule_results = rule_checker.check_reading_detailed(reading, history)
    qc_flag = "GOOD"
    reason = "All basic rule checks passed"
    for result in rule_results:
        if not result["passed"]:
            qc_flag = "FAULTY"
            reason = result["detail"]
            break

    spatial: dict[str, Any] = {
        "checked": False,
        "anomaly": False,
        "reason": "NO_NEIGHBOURS",
        "neighbour_avg": None,
        "neighbour_count": 0,
        "diff_c": None,
    }
    spatial_average = None
    if neighbours:
        spatial_anomaly, spatial_reason, spatial_average = (
            spatial_checker.evaluate_spatial_consistency(reading, neighbours)
        )
        spatial.update({
            "checked": True,
            "anomaly": spatial_anomaly,
            "reason": spatial_reason,
            "neighbour_avg": spatial_average,
            "neighbour_count": len(neighbours),
            "diff_c": (
                round(abs(reading["temperature"] - spatial_average), 2)
                if spatial_average is not None else None
            ),
        })
        if spatial_anomaly:
            qc_flag, reason = "FAULTY", spatial_reason

    is_anomaly = qc_flag != "GOOD"

    lstm_info: dict[str, Any] = {
        "available": bool(lstm_engine and lstm_engine.ready),
        "ran": False,
        "reason": None,
        "prediction": None,
    }
    lstm_prediction = None
    lstm_window = lstm_history if lstm_history is not None else history
    if is_anomaly and lstm_engine and lstm_engine.ready and len(lstm_window) == 12:
        sequence = [
            [item["temperature"], item["pressure"], item["humidity"]]
            for item in lstm_window
        ]
        lstm_prediction = lstm_engine.predict_next(sequence)
        lstm_info.update({"ran": True, "prediction": lstm_prediction})
    elif is_anomaly:
        if not (lstm_engine and lstm_engine.ready):
            lstm_info["reason"] = "ONNX LSTM model not loaded."
        else:
            lstm_info["reason"] = (
                f"LSTM needs a full 12-step distinct-observation window; "
                f"only {len(lstm_window)} available."
            )

    repaired = repair_pipeline.repair_observation(
        reading,
        is_anomaly,
        reason,
        lstm_predicted=lstm_prediction,
        spatial_avg_temp=spatial_average,
    )

    return {
        "qc_flag": qc_flag,
        "flag_reason": reason,
        "has_anomaly": is_anomaly,
        "rule_results": rule_results,
        "spatial": spatial,
        "lstm": lstm_info,
        "repaired": repaired,
        "repair_method": repaired.get("repair_method", "NONE"),
    }
