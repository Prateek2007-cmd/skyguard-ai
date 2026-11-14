"""Freshness / dropout detection.

A missing observation is itself a signal: a station that stops reporting is
either down or disconnected. This is deliberately separate from the
value-based checkers — there is no reading to check, only a gap.
"""

from __future__ import annotations

from datetime import datetime, timezone

DEFAULT_MAX_GAP_MINUTES = 120


def parse_observed_at(value: str | None) -> datetime | None:
    """Parse an upstream observation timestamp (ISO, any tz) to UTC."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def check_freshness(
    last_observed_at: str | None,
    now: datetime | None = None,
    max_gap_minutes: int = DEFAULT_MAX_GAP_MINUTES,
) -> dict[str, object]:
    """Return whether a station is stale and by how much."""
    now = now or datetime.now(timezone.utc)
    last = parse_observed_at(last_observed_at)
    if last is None:
        return {
            "is_stale": True,
            "gap_minutes": None,
            "reason": "No observation timestamp recorded for this station.",
        }
    gap_minutes = (now - last).total_seconds() / 60.0
    is_stale = gap_minutes > max_gap_minutes
    return {
        "is_stale": is_stale,
        "gap_minutes": round(gap_minutes, 1),
        "reason": (
            f"No distinct observation for {gap_minutes:.0f} minutes "
            f"(threshold {max_gap_minutes} min)."
            if is_stale
            else f"Last distinct observation {gap_minutes:.0f} minutes ago."
        ),
    }
