"""Engine tests: pure computation, no network, no database."""

from datetime import datetime, timedelta, timezone

from app.engine.evaluation import run_evaluation
from app.engine.explain import evidence_score, root_cause_for, severity_for
from app.engine.freshness import check_freshness
from app.engine.rule_checker import RuleChecker

READING = {"temperature": 28.0, "pressure": 1012.0, "humidity": 60.0}


def _history(temp=28.0, span_minutes=45, n=4, vary=False):
    anchor = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
    step = span_minutes / max(n - 1, 1)
    # A genuinely normal history varies; identical values across a span
    # IS the frozen-sensor pattern, so `vary` must be on for normal cases.
    deltas = [0.4, -0.3, 0.5, -0.2, 0.1, -0.4]
    return [
        {
            "temperature": round(temp + (deltas[i % len(deltas)] if vary else 0.0), 2),
            "pressure": 1012.0,
            "humidity": 60.0,
            "observed_at": (anchor + timedelta(minutes=step * i)).isoformat(),
        }
        for i in range(n)
    ]


def test_range_violation_flagged():
    checker = RuleChecker()
    flag, reason = checker.check_reading({**READING, "temperature": 62.0})
    assert flag == "FAULTY"
    assert "out of valid range" in reason


def test_normal_reading_passes():
    checker = RuleChecker()
    flag, _ = checker.check_reading(READING, _history(vary=True))
    assert flag == "GOOD"


def test_flatline_flags_only_across_a_real_span():
    checker = RuleChecker()
    # Identical values across 45 minutes of distinct observations: frozen.
    flag, reason = checker.check_reading(READING, _history(span_minutes=45))
    assert flag == "FAULTY"
    assert "flatline" in reason.lower()
    # Identical values spanning only 10 minutes: stable weather, not frozen.
    flag, _ = checker.check_reading(READING, _history(span_minutes=10))
    assert flag == "GOOD"


def test_flatline_needs_four_prior_readings():
    checker = RuleChecker()
    flag, _ = checker.check_reading(READING, _history(n=3))
    assert flag == "GOOD"


def test_flatline_looks_at_the_recent_window_not_all_history():
    # A sensor that varied for hours and THEN froze must still be flagged:
    # only the last 4 history rows plus the current reading decide.
    checker = RuleChecker()
    older = _history(vary=True, span_minutes=600, n=8)
    frozen = _history(temp=28.0, span_minutes=45, n=4)
    # Shift the frozen window after the varying one so timestamps order.
    flag, reason = checker.check_reading(READING, older + frozen)
    assert flag == "FAULTY"
    assert "flatline" in reason.lower()


def test_explain_labels_are_heuristic_not_probability():
    result = evidence_score("Temperature 62.0°C out of valid range (-10.0, 55.0)")
    assert result["method"] == "heuristic"
    assert "not a model probability" in result["note"]
    assert result["score"] >= 45
    assert severity_for("SPATIAL_ANOMALY: Diff of 9.0°C", "FAULTY") == "high"
    assert root_cause_for("Sensor flatline detected")["category"] == "stuck_sensor"


def test_freshness_gap_detection():
    now = datetime.now(timezone.utc)
    recent = (now - timedelta(minutes=30)).isoformat()
    assert check_freshness(recent, now=now)["is_stale"] is False
    old = (now - timedelta(minutes=300)).isoformat()
    stale = check_freshness(old, now=now)
    assert stale["is_stale"] is True
    assert stale["gap_minutes"] == 300.0
    assert check_freshness(None, now=now)["is_stale"] is True


def test_evaluation_is_deterministic_and_honest():
    first = run_evaluation(seed=42, n_cases=240)
    second = run_evaluation(seed=42, n_cases=240)
    assert first == second
    assert first["dataset"]["labelled"] == "synthetic"
    metrics = first["metrics"]
    for key in ("precision", "recall", "f1", "false_alarm_rate", "accuracy"):
        assert 0.0 <= metrics[key] <= 1.0
    confusion = first["confusion"]
    assert sum(confusion.values()) == 240
    # Drift is the known-weak class: no drift detector exists, so its recall
    # must be below the spike recall. If this ever flips, the pipeline changed.
    recall = first["per_fault_recall"]
    assert recall["drift"] is not None and recall["spike"] is not None
    assert recall["drift"] < recall["spike"]
    assert recall["range"] == 1.0  # range violations cannot be missed
    assert first["freshness"]["accuracy"] == 1.0
