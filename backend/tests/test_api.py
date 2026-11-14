"""API tests with a stubbed Open-Meteo fetcher and a scratch database.

The live Open-Meteo API is NOT called here: the stub returns deterministic
readings, and the test controls the upstream observation clock explicitly
(`StubFetcher.tick`), which is what makes the dedupe / flatline behaviour
testable without waiting on real model runs.

Run from backend/:  SKYGUARD_DB_PATH is set to a temp file by this module
before the app is imported.
"""

import os
import tempfile
from datetime import datetime, timedelta, timezone
from urllib.error import URLError

_TMP = tempfile.mkdtemp(prefix="skyguard-test-")
os.environ["SKYGUARD_DB_PATH"] = os.path.join(_TMP, "test.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api import extended, routes  # noqa: E402
from main import app  # noqa: E402

BASE_TIME = datetime(2026, 11, 14, 6, 0, tzinfo=timezone.utc)


class StubFetcher:
    """Deterministic stand-in for LiveWeatherFetcher.

    tick: upstream observation index. Each tick is 15 minutes of upstream
    time. Values stay identical across ticks unless the test overrides them,
    which reproduces exactly the slow-upstream behaviour the flatline fix
    addresses.
    """

    def __init__(self):
        self.tick = 0
        self.overrides: dict[str, dict] = {}

    def fetch_live_station_data(self, lat, lon, station_id):
        index = 0 if station_id == "AWS_CENTER_0" else int(station_id[-2:])
        observed_at = (BASE_TIME + timedelta(minutes=15 * self.tick)).isoformat()
        reading = {
            "station_id": station_id,
            "temperature": round(28.0 + 0.3 * index, 2),
            "pressure": round(1012.0 + 0.2 * index, 2),
            "humidity": round(60.0 + index, 2),
            "latitude": lat,
            "longitude": lon,
            "observed_at": observed_at,
        }
        reading.update(self.overrides.get(station_id, {}))
        return reading


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def stub(monkeypatch):
    fetcher = StubFetcher()
    monkeypatch.setattr(routes, "weather_fetcher", fetcher)
    monkeypatch.setattr(extended, "weather_fetcher", fetcher)
    return fetcher


def _live(client, count=6):
    response = client.get(
        f"/api/v1/live-surrounding-stations?lat=17.385&lon=78.4866&count={count}"
    )
    assert response.status_code == 200, response.text
    return response.json()["stations"]


def _row_count(client, station_id="AWS_CENTER_0"):
    response = client.get(f"/api/v1/stations/{station_id}/history?limit=500")
    assert response.status_code == 200
    return len(response.json()["observations"])


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    assert response.json()["onnx_lstm_ready"] is True


def test_duplicate_observation_is_not_stored_twice(client, stub):
    stub.tick = 0
    first = _live(client)
    assert all(not s["is_duplicate"] for s in first)
    assert _row_count(client) == 1
    # Same upstream observation re-fetched: returned, not re-stored.
    second = _live(client)
    assert all(s["is_duplicate"] for s in second)
    assert _row_count(client) == 1
    assert second[0]["temperature"] == first[0]["temperature"]


def test_flatline_flags_only_after_distinct_observations(client, stub):
    # Fresh station ring: use a different centre so history starts empty.
    # Five distinct upstream observations, identical values, 15 min apart.
    for tick in range(5):
        stub.tick = 100 + tick
        stations = _live(client)
    centre = next(s for s in stations if s["station_id"] == "AWS_CENTER_0")
    assert centre["has_anomaly"] is True
    assert centre["qc_flag"] == "FAULTY"
    assert "flatline" in centre["flag_reason"].lower()


def test_lstm_repair_runs_with_a_full_window(client, stub):
    # Twelve distinct observations, then one more anomalous poll: the LSTM
    # has its full 12-step window and performs the repair.
    for tick in range(12):
        stub.tick = 200 + tick
        _live(client)
    stub.tick = 212
    stations = _live(client)
    centre = next(s for s in stations if s["station_id"] == "AWS_CENTER_0")
    assert centre["has_anomaly"] is True
    assert centre["repair_method"] == "LSTM_ONNX_INFERENCE"


def test_history_and_alerts_endpoints(client, stub):
    history = client.get("/api/v1/stations/AWS_CENTER_0/history?limit=500")
    assert history.status_code == 200
    rows = history.json()["observations"]
    assert len(rows) >= 13
    assert rows == sorted(rows, key=lambda r: r["timestamp"])

    alerts = client.get("/api/v1/alerts?limit=200")
    assert alerts.status_code == 200
    payload = alerts.json()
    assert payload["total"] >= 1
    alert = payload["alerts"][0]
    assert alert["severity"] in ("low", "medium", "high")
    assert alert["evidence"]["method"] == "heuristic"
    assert alert["root_cause"]["category"] == "stuck_sensor"

    detail = client.get(f"/api/v1/alerts/{alert['id']}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["rule_results"]
    assert body["before_after"]["raw"]["temperature"] is not None
    assert body["repair_explanation"]


def test_health_summary_is_computed_from_stored_rows(client, stub):
    response = client.get("/api/v1/health/summary")
    assert response.status_code == 200
    body = response.json()
    assert body["stations_observed"] == 6
    centre = next(
        s for s in body["stations"] if s["station_id"] == "AWS_CENTER_0"
    )
    assert centre["readings"] >= 13
    assert centre["anomalies"] >= 1
    assert 0 <= centre["health_score"] <= 100
    assert centre["maintenance_priority"] in ("low", "medium", "high")
    assert "health_score" in body["method"]


def test_simulation_spike_uses_real_pipeline_and_persists_nothing(
    client, stub
):
    async def fake_neighbours(nodes):
        return [
            {
                "station_id": node["station_id"],
                "temperature": 28.0,
                "pressure": 1012.0,
                "humidity": 60.0,
                "latitude": node["lat"],
                "longitude": node["lon"],
            }
            for node in nodes
        ]

    import app.api.extended as ext

    orig = ext._fetch_weather_for_nodes
    ext._fetch_weather_for_nodes = fake_neighbours
    try:
        before = _row_count(client)
        response = client.post("/api/v1/simulate", json={
            "station_id": "AWS_CENTER_0",
            "latitude": 17.385,
            "longitude": 78.4866,
            "scenario": "spike",
            "value": 47.0,
        })
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["simulated"] is True
        assert body["persisted"] is False
        assert body["summary"]["detected"] is True
        step = body["steps"][0]
        assert step["has_anomaly"] is True
        assert step["injected"]["temperature"] == 47.0
        assert step["repaired"]["temperature"] != 47.0
        assert step["rule_results"]
        assert _row_count(client) == before
    finally:
        ext._fetch_weather_for_nodes = orig


def test_simulation_official55_is_caught_by_spatial_check(client, stub):
    async def fake_neighbours(nodes):
        return [
            {
                "station_id": node["station_id"],
                "temperature": 28.0,
                "pressure": 1012.0,
                "humidity": 60.0,
                "latitude": node["lat"],
                "longitude": node["lon"],
            }
            for node in nodes
        ]

    import app.api.extended as ext

    orig = ext._fetch_weather_for_nodes
    ext._fetch_weather_for_nodes = fake_neighbours
    try:
        response = client.post("/api/v1/simulate", json={
            "station_id": "AWS_CENTER_0",
            "latitude": 17.385,
            "longitude": 78.4866,
            "scenario": "official55",
        })
        assert response.status_code == 200, response.text
        step = response.json()["steps"][0]
        # 55 C sits on the range boundary, so the range rule passes; the
        # spatial check (55 vs ~28 neighbours) is what catches it.
        assert step["has_anomaly"] is True
        assert "SPATIAL" in step["flag_reason"]
        assert step["spatial"]["anomaly"] is True
    finally:
        ext._fetch_weather_for_nodes = orig


def test_simulation_upstream_failure_is_502_not_500(client, stub, monkeypatch):
    """A dead upstream must surface as 502 (bad gateway), never a bare 500:
    the UI renders 502 as 'upstream unavailable', 500 as 'backend broken'."""

    class RaisingFetcher:
        def fetch_live_station_data(self, lat, lon, station_id):
            raise URLError("open-meteo down")

    import app.api.extended as ext

    monkeypatch.setattr(ext, "weather_fetcher", RaisingFetcher())
    response = client.post("/api/v1/simulate", json={
        "station_id": "AWS_CENTER_0",
        "latitude": 17.385,
        "longitude": 78.4866,
        "scenario": "spike",
        "value": 47.0,
    })
    assert response.status_code == 502


def test_simulation_custom_without_value_is_422_even_when_upstream_down(
    client, stub, monkeypatch
):
    """Request validation happens before any upstream fetch."""

    class RaisingFetcher:
        def fetch_live_station_data(self, lat, lon, station_id):
            raise URLError("open-meteo down")

    import app.api.extended as ext

    monkeypatch.setattr(ext, "weather_fetcher", RaisingFetcher())
    response = client.post("/api/v1/simulate", json={
        "station_id": "AWS_CENTER_0",
        "latitude": 17.385,
        "longitude": 78.4866,
        "scenario": "custom",
    })
    assert response.status_code == 422


def test_evaluation_endpoint_returns_computed_metrics(client):
    response = client.get("/api/v1/evaluation?seed=42&n_cases=240")
    assert response.status_code == 200
    body = response.json()
    assert body["dataset"]["labelled"] == "synthetic"
    assert body["dataset"]["seed"] == 42
    metrics = body["metrics"]
    assert 0.0 <= metrics["precision"] <= 1.0
    assert 0.0 <= metrics["recall"] <= 1.0
    assert body["confusion"]["tp"] + body["confusion"]["fp"] \
        + body["confusion"]["tn"] + body["confusion"]["fn"] == 240
