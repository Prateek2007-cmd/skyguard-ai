import json
import math
import threading
import time
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

# Upstream "current" values update on model runs, not per request, so
# re-fetching the same coordinates every 30 s wastes the free-tier quota
# (10k calls/day/IP — the shared egress IP of a demo venue can exhaust it)
# and adds latency to every poll. Cache per coordinate pair for 10 minutes;
# the cached payload still carries its original upstream observation time.
_CACHE_TTL_SECONDS = 600.0
_cache: dict[tuple[float, float], tuple[float, dict[str, Any]]] = {}
_cache_lock = threading.Lock()


class LiveWeatherFetcher:
    base_url = "https://api.open-meteo.com/v1/forecast"

    def fetch_live_station_data(
        self,
        lat: float,
        lon: float,
        station_id: str,
    ) -> dict[str, Any]:
        cache_key = (round(lat, 4), round(lon, 4))
        with _cache_lock:
            hit = _cache.get(cache_key)
            if hit and time.monotonic() - hit[0] < _CACHE_TTL_SECONDS:
                cached = dict(hit[1])
                cached["station_id"] = station_id
                return cached

        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,surface_pressure",
            # UTC, deliberately — NOT "auto". Open-Meteo returns
            # current.time naive in the requested timezone, and every
            # consumer of observed_at (freshness.py, rule_checker.py,
            # the frontend's parseApiTime) parses naive timestamps as
            # UTC. With "auto" a Hyderabad observation came back as
            # naive IST, mislabelled by +5:30: the UI showed "Observed
            # 02:30 PM · fetched 09:05 AM" for the same instant, and
            # freshness gaps were understated by 5.5 hours.
            "timezone": "UTC",
        }

        url = f"{self.base_url}?{urlencode(params)}"
        with urlopen(url, timeout=10) as response:
            payload = json.load(response)

        if not isinstance(payload, dict):
            raise ValueError("Open-Meteo response has an invalid format.")

        current = payload.get("current")
        if not isinstance(current, dict):
            raise ValueError("Open-Meteo response has no current observation.")

        measurements = {
            "temperature": current.get("temperature_2m"),
            "pressure": current.get("surface_pressure"),
            "humidity": current.get("relative_humidity_2m"),
        }
        if any(value is None or not math.isfinite(float(value)) for value in measurements.values()):
            raise ValueError("Open-Meteo response is missing a valid weather measurement.")

        result = {
            "station_id": station_id,
            **{key: float(value) for key, value in measurements.items()},
            "latitude": lat,
            "longitude": lon,
            # Upstream observation timestamp. Open-Meteo "current" values
            # update on model runs, not per request — this timestamp is what
            # distinguishes a genuinely new observation from a re-fetch of
            # the same one (see the flatline fix in routes.py).
            "observed_at": current.get("time"),
        }
        with _cache_lock:
            _cache[cache_key] = (time.monotonic(), dict(result))
        return result
