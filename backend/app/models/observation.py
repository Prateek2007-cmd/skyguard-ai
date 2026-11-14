from sqlalchemy import Column, String, Float, DateTime
from datetime import datetime
from app.core.database import Base

class Observation(Base):
    __tablename__ = "observations"

    id = Column(String, primary_key=True)
    station_id = Column(String, index=True)
    # When this row was written by SkyGuard (ingestion time).
    timestamp = Column(DateTime, default=datetime.utcnow)
    # Upstream observation time from Open-Meteo ("current.time"). Distinct
    # observations have distinct observed_at values; re-fetches of the same
    # upstream observation share one. Used to dedupe ingestion and to
    # evaluate frozen-sensor rules only across genuinely distinct readings.
    observed_at = Column(String, index=True, nullable=True)
    # Repaired (final) values — what the dashboard shows as the reading.
    temperature = Column(Float)
    pressure = Column(Float)
    humidity = Column(Float)
    # Raw sensor values before repair, kept for before/after comparison.
    raw_temperature = Column(Float, nullable=True)
    raw_pressure = Column(Float, nullable=True)
    raw_humidity = Column(Float, nullable=True)
    repaired_temperature = Column(Float, nullable=True)
    repair_method = Column(String, nullable=True)
    qc_flag = Column(String)  # GOOD, SUSPECT, FAULTY
    flag_reason = Column(String)
