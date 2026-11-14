"""Fetcher regression tests. No network: urlopen is stubbed.

The observed_at timezone is a real bug that shipped: the fetcher asked
Open-Meteo for timezone=auto, which returns current.time naive in the
station's LOCAL timezone, while every consumer parses naive timestamps
as UTC — a Hyderabad observation was mislabelled by +5:30.
"""

import io
import json
from unittest.mock import patch

from app.engine import external_fetcher


def _payload(time="2026-11-14T09:00"):
    return {
        "current": {
            "time": time,
            "temperature_2m": 30.3,
            "relative_humidity_2m": 31.0,
            "surface_pressure": 957.7,
        }
    }


def _stub_urlopen(payload):
    """urlopen stub returning `payload` as JSON; records the requested URL."""

    class _Response(io.StringIO):
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    calls = {}

    def fake_urlopen(url, timeout=10):
        calls["url"] = url
        return _Response(json.dumps(payload))

    return fake_urlopen, calls


def test_fetcher_requests_utc_timezone():
    """observed_at must be UTC-naive, matching the naive=UTC convention."""
    external_fetcher._cache.clear()
    fake_urlopen, calls = _stub_urlopen(_payload())
    with patch.object(external_fetcher, "urlopen", fake_urlopen):
        result = external_fetcher.LiveWeatherFetcher().fetch_live_station_data(
            17.385, 78.4866, "AWS_CENTER_0"
        )
    assert "timezone=UTC" in calls["url"]
    assert result["observed_at"] == "2026-11-14T09:00"
    assert result["temperature"] == 30.3
    external_fetcher._cache.clear()
