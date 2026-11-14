"""Seed a SYNTHETIC demo database for local UI development only.

The rows are generated from diurnal sine curves + noise, run through the
REAL detection + repair pipeline, and stored with realistic timestamps.
They are NOT live observations and must never be presented as such.

Why this exists: the live path needs Open-Meteo, whose free tier is shared
per egress IP — on a rate-limited network the dashboard's history, alerts
and health pages would be empty. This script lets the frontend be exercised
against plausible stored data.

Usage:
    python backend/scripts/seed_demo_db.py            # writes backend/demo.db
    SKYGUARD_DB_PATH=backend/demo.db uvicorn main:app # run the server on it

The default database (backend/skyguard.db) is never touched unless
SKYGUARD_DB_PATH points at it explicitly.
"""

import asyncio
import math
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

_BACKEND_DIR = Path(__file__).resolve().parents[1]
os.environ.setdefault("SKYGUARD_DB_PATH", str(_BACKEND_DIR / "demo.db"))
sys.path.insert(0, str(_BACKEND_DIR))

from app.core.database import AsyncSessionLocal, init_db  # noqa: E402
from app.engine.pipeline import run_detection_pipeline  # noqa: E402
from app.models.observation import Observation  # noqa: E402

STATIONS = [
    ("AWS_CENTER_0", 17.3850, 78.4866),
    ("AWS_DYNAMIC_01", 17.7450, 78.4866),
    ("AWS_DYNAMIC_02", 17.5650, 78.8000),
    ("AWS_DYNAMIC_03", 17.2050, 78.8000),
    ("AWS_DYNAMIC_04", 17.0250, 78.4866),
    ("AWS_DYNAMIC_05", 17.2050, 78.1732),
]


def _baseline(rng: random.Random, hour: float) -> dict:
    temp = 26 + 7 * math.sin(2 * math.pi * hour / 24) + rng.gauss(0, 0.5)
    press = 1012 - 2.5 * math.sin(2 * math.pi * hour / 24) + rng.gauss(0, 0.3)
    hum = 58 - 18 * math.sin(2 * math.pi * hour / 24) + rng.gauss(0, 1.0)
    return {
        "temperature": round(temp, 2),
        "pressure": round(press, 2),
        "humidity": round(max(5.0, min(98.0, hum)), 2),
    }


async def seed(n_hours: int = 36, seed: int = 7) -> None:
    await init_db()
    rng = random.Random(seed)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    inserted = 0
    flagged = 0

    async with AsyncSessionLocal() as db:
        for station_id, lat, lon in STATIONS:
            raw_history: list[dict] = []
            clean_history: list[dict] = []
            for back in range(n_hours, 0, -1):
                tick = now - timedelta(hours=back)
                hour = tick.hour + tick.minute / 60.0
                base = _baseline(rng, hour)
                reading = {
                    **base,
                    "latitude": lat,
                    "longitude": lon,
                }
                # A few deliberate faults so alerts/health have real rows:
                # a spike on station 2, a frozen run on station 4, a spatial
                # outlier on station 1 — all inside the last 12 hours.
                if station_id == "AWS_DYNAMIC_02" and back == 5:
                    reading["temperature"] = round(base["temperature"] + 16.0, 2)
                if station_id == "AWS_DYNAMIC_04" and back <= 5:
                    reading["temperature"] = 31.40  # frozen value (5 ticks:
                    # the flatline rule needs 4 identical history rows plus
                    # the current reading, so the final tick flags)
                if station_id == "AWS_DYNAMIC_01" and back == 8:
                    reading["temperature"] = round(base["temperature"] + 9.0, 2)
                neighbours = [
                    {
                        "latitude": nlat,
                        "longitude": nlon,
                        "temperature": round(base["temperature"] + rng.gauss(0, 0.7), 2),
                    }
                    for sid, nlat, nlon in STATIONS
                    if sid != station_id
                ]
                result = await asyncio.to_thread(
                    run_detection_pipeline,
                    reading,
                    neighbours,
                    raw_history,
                    None,  # LSTM needs the ONNX model; seed stays light.
                    clean_history,
                )
                repaired = result["repaired"]
                db.add(Observation(
                    id=str(uuid4()),
                    station_id=station_id,
                    timestamp=tick + timedelta(minutes=2),
                    observed_at=tick.isoformat(),
                    temperature=repaired["temperature"],
                    pressure=repaired["pressure"],
                    humidity=repaired["humidity"],
                    raw_temperature=reading["temperature"],
                    raw_pressure=reading["pressure"],
                    raw_humidity=reading["humidity"],
                    repaired_temperature=repaired["temperature"],
                    repair_method=result["repair_method"],
                    qc_flag=result["qc_flag"],
                    flag_reason=result["flag_reason"],
                ))
                raw_history.append({
                    "temperature": reading["temperature"],
                    "pressure": reading["pressure"],
                    "humidity": reading["humidity"],
                    "observed_at": tick.isoformat(),
                })
                clean_history.append({
                    "temperature": repaired["temperature"],
                    "pressure": repaired["pressure"],
                    "humidity": repaired["humidity"],
                    "observed_at": tick.isoformat(),
                })
                raw_history = raw_history[-12:]
                clean_history = clean_history[-12:]
                inserted += 1
                flagged += 1 if result["has_anomaly"] else 0
        await db.commit()

    print(f"Seeded {inserted} SYNTHETIC observations "
          f"({flagged} flagged) into {os.environ['SKYGUARD_DB_PATH']}")
    print("SYNTHETIC DEMO DATA — local UI development only, not live data.")


if __name__ == "__main__":
    asyncio.run(seed())
