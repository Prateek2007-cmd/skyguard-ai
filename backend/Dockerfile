# SkyGuard backend — FastAPI + ONNX Runtime. No torch needed at runtime.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# libgomp1 is required by onnxruntime and scikit-learn on slim images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-runtime.txt ./
RUN pip install -r requirements-runtime.txt

COPY main.py ./
COPY app ./app
COPY models_store ./models_store

# SQLite lives in the container by default; mount a volume at /app/data and
# set SKYGUARD_DB_PATH=/app/data/skyguard.db for persistent history.
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
