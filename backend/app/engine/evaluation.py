"""Reproducible model-evaluation harness.

Builds a seeded, labelled, explicitly SYNTHETIC test set and runs the real
detection checkers (RuleChecker + SpatialKNNChecker + freshness) over it,
then computes precision / recall / F1 / confusion matrix from the results.

Nothing here is hardcoded: every number in the response is computed from the
harness run. The dataset is synthetic by design — no labelled real AWS
fault data exists in this repo — and the response says so. Drift cases are
expected to score poorly: the live pipeline has no drift detector yet, and
the harness reports that honestly instead of hiding it.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone

from app.engine.freshness import check_freshness
from app.engine.knn_checker import SpatialKNNChecker
from app.engine.rule_checker import RuleChecker

DEFAULT_SEED = 42
DEFAULT_N_CASES = 240

# Centre point for synthetic station geometry (Hyderabad, matches the app
# default). Neighbours sit 10-30 km away so they fall inside the 50 km
# spatial window.
_CENTRE_LAT = 17.3850
_CENTRE_LON = 78.4866
_NEIGHBOUR_OFFSETS = [(0.12, 0.10), (-0.15, 0.08), (0.09, -0.18),
                       (-0.11, -0.13), (0.22, -0.05)]

_FAULT_TYPES = ("spike", "range", "frozen", "spatial", "drift")


def _baseline(rng: random.Random, hour: float) -> dict[str, float]:
    """Plausible normal reading: diurnal sine + noise (same family of curves
    the LSTM was trained on, but a different seed and draw)."""
    temp = 26 + 7 * math.sin(2 * math.pi * hour / 24) + rng.gauss(0, 0.6)
    press = 1012 - 2.5 * math.sin(2 * math.pi * hour / 24) + rng.gauss(0, 0.4)
    hum = 58 - 18 * math.sin(2 * math.pi * hour / 24) + rng.gauss(0, 1.2)
    return {
        "temperature": round(temp, 2),
        "pressure": round(press, 2),
        "humidity": round(max(5.0, min(98.0, hum)), 2),
    }


def _neighbours(rng: random.Random, base: dict[str, float]) -> list[dict]:
    return [
        {
            "latitude": _CENTRE_LAT + dlat,
            "longitude": _CENTRE_LON + dlon,
            "temperature": round(base["temperature"] + rng.gauss(0, 0.8), 2),
        }
        for dlat, dlon in _NEIGHBOUR_OFFSETS
    ]


def _history(
    rng: random.Random,
    base: dict[str, float],
    frozen_value: float | None = None,
    anchor: datetime | None = None,
) -> list[dict]:
    """Four prior distinct observations, 15 minutes apart (45-minute span,
    so the flatline span guard can engage on genuinely frozen data)."""
    anchor = anchor or datetime.now(timezone.utc)
    rows = []
    for step in range(4):
        temp = frozen_value if frozen_value is not None else round(
            base["temperature"] + rng.gauss(0, 0.5), 2
        )
        rows.append({
            "temperature": temp,
            "pressure": round(base["pressure"] + rng.gauss(0, 0.3), 2),
            "humidity": round(base["humidity"] + rng.gauss(0, 1.0), 2),
            "observed_at": (
                anchor - timedelta(minutes=15 * (4 - step))
            ).isoformat(),
        })
    return rows


def _generate_cases(seed: int, n_cases: int) -> list[dict]:
    """Labelled synthetic cases. ~55% normal, the rest split across fault
    types. Drift cases are the known-weak class (no drift detector)."""
    rng = random.Random(seed)
    cases: list[dict] = []
    anchor = datetime(2026, 11, 1, tzinfo=timezone.utc)
    for index in range(n_cases):
        hour = rng.uniform(0, 24)
        base = _baseline(rng, hour)
        roll = rng.random()
        if roll < 0.55:
            fault = "normal"
            reading = dict(base)
            history = _history(rng, base, anchor=anchor)
            neighbours = _neighbours(rng, base)
        elif roll < 0.70:
            fault = "spike"
            reading = dict(base)
            reading["temperature"] = round(base["temperature"] + rng.uniform(12, 20), 2)
            history = _history(rng, base, anchor=anchor)
            neighbours = _neighbours(rng, base)
        elif roll < 0.79:
            fault = "range"
            reading = dict(base)
            reading["temperature"] = round(rng.choice([rng.uniform(58, 70), rng.uniform(-20, -12)]), 2)
            history = _history(rng, base, anchor=anchor)
            neighbours = _neighbours(rng, base)
        elif roll < 0.88:
            fault = "frozen"
            reading = dict(base)
            history = _history(rng, base, frozen_value=reading["temperature"], anchor=anchor)
            neighbours = _neighbours(rng, base)
        elif roll < 0.95:
            fault = "spatial"
            reading = dict(base)
            reading["temperature"] = round(base["temperature"] + rng.uniform(8, 12), 2)
            # Keep the spike inside the physical range so ONLY the spatial
            # check can catch it.
            reading["temperature"] = min(reading["temperature"], 54.0)
            history = _history(rng, base, anchor=anchor)
            neighbours = _neighbours(rng, base)
        else:
            fault = "drift"
            reading = dict(base)
            # A slow drift that has moved ~4 C from baseline: inside range,
            # inside the 5 C spatial threshold, invisible to the rule
            # checker. Expected to be missed — reported, not hidden.
            reading["temperature"] = round(base["temperature"] + 4.0, 2)
            history = _history(rng, base, anchor=anchor)
            neighbours = _neighbours(rng, base)
        cases.append({
            "id": index,
            "fault": fault,
            "label_anomaly": fault != "normal",
            "reading": {
                **reading,
                "latitude": _CENTRE_LAT,
                "longitude": _CENTRE_LON,
            },
            "history": history,
            "neighbours": neighbours,
        })
    return cases


def _prf(tp: int, fp: int, tn: int, fn: int) -> dict[str, float]:
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "false_alarm_rate": round(fp / (fp + tn), 4) if (fp + tn) else 0.0,
        "accuracy": round((tp + tn) / (tp + fp + tn + fn), 4) if (tp + fp + tn + fn) else 0.0,
    }


def run_evaluation(seed: int = DEFAULT_SEED, n_cases: int = DEFAULT_N_CASES) -> dict:
    """Run the harness and return computed metrics (never hardcoded)."""
    rule_checker = RuleChecker()
    spatial_checker = SpatialKNNChecker(max_distance_km=50.0)
    cases = _generate_cases(seed, n_cases)

    tp = fp = tn = fn = 0
    rule_tp = rule_fp = rule_tn = rule_fn = 0
    per_fault: dict[str, dict[str, int]] = {
        fault: {"total": 0, "caught": 0} for fault in _FAULT_TYPES
    }
    false_positives: list[dict] = []
    false_negatives: list[dict] = []

    for case in cases:
        reading = case["reading"]
        qc_flag, reason = rule_checker.check_reading(reading, case["history"])
        rule_anomaly = qc_flag != "GOOD"
        spatial_anomaly, spatial_reason, _avg = spatial_checker.evaluate_spatial_consistency(
            reading, case["neighbours"]
        )
        predicted = rule_anomaly or spatial_anomaly
        actual = case["label_anomaly"]

        for bucket, pred in (("combined", predicted), ("rule", rule_anomaly)):
            if bucket == "combined":
                if pred and actual:
                    tp += 1
                elif pred and not actual:
                    fp += 1
                elif not pred and actual:
                    fn += 1
                else:
                    tn += 1
            else:
                if pred and actual:
                    rule_tp += 1
                elif pred and not actual:
                    rule_fp += 1
                elif not pred and actual:
                    rule_fn += 1
                else:
                    rule_tn += 1

        if case["fault"] != "normal":
            per_fault[case["fault"]]["total"] += 1
            if predicted:
                per_fault[case["fault"]]["caught"] += 1

        if predicted and not actual and len(false_positives) < 5:
            false_positives.append({
                "case_id": case["id"],
                "temperature": reading["temperature"],
                "reason": reason if rule_anomaly else spatial_reason,
            })
        if actual and not predicted and len(false_negatives) < 5:
            false_negatives.append({
                "case_id": case["id"],
                "fault": case["fault"],
                "temperature": reading["temperature"],
                "reason": "No rule or spatial check triggered.",
            })

    # Freshness (dropout) is evaluated separately: it operates on time gaps,
    # not values, so it cannot share the value confusion matrix.
    now = datetime.now(timezone.utc)
    freshness_cases = 20
    freshness_correct = 0
    for index in range(freshness_cases):
        gap = 30 if index % 2 == 0 else 300  # alternating healthy / dropout
        last = (now - timedelta(minutes=gap)).isoformat()
        result = check_freshness(last, now=now)
        expected_stale = gap > 120
        if result["is_stale"] == expected_stale:
            freshness_correct += 1

    composition = {"normal": 0}
    composition.update({fault: 0 for fault in _FAULT_TYPES})
    for case in cases:
        composition[case["fault"]] += 1

    return {
        "dataset": {
            "labelled": "synthetic",
            "seed": seed,
            "total_cases": len(cases),
            "composition": composition,
            "generated_by": (
                "Seeded harness (seed 42): diurnal sine baselines + noise, "
                "faults injected per case. No real AWS fault data exists in "
                "this repo, so scores measure the checkers against synthetic "
                "faults, not field performance."
            ),
        },
        "metrics": _prf(tp, fp, tn, fn),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "per_fault_recall": {
            fault: (
                round(stats["caught"] / stats["total"], 4)
                if stats["total"] else None
            )
            for fault, stats in per_fault.items()
        },
        "per_method": {
            "rule_only": _prf(rule_tp, rule_fp, rule_tn, rule_fn),
            "rule_plus_spatial": _prf(tp, fp, tn, fn),
        },
        "freshness": {
            "cases": freshness_cases,
            "correct": freshness_correct,
            "accuracy": round(freshness_correct / freshness_cases, 4),
            "method": "Gap > 120 min since last distinct observation.",
        },
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "limitations": [
            "Synthetic faults only — scores do not measure field performance.",
            "Drift recall is expected to be low: the live pipeline has no drift detector yet.",
            "The ONNX LSTM is not scored here: it repairs flagged readings, it does not classify.",
        ],
    }
