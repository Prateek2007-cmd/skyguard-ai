"""Phase 0 flatline observation.

Polls the live-stations endpoint every ``interval`` seconds and records, per
station, the reported values and QC flags — alongside a direct Open-Meteo
fetch for the centre coordinates, so upstream observation timestamps can be
compared with what the API stores.

Purpose: verify (or refute) the hypothesis that Open-Meteo "current" values
change more slowly than the 30 s frontend poll, so consecutive stored rows
are identical and trip the "sensor frozen" (flatline) rule.

Usage (backend running on :8000, fresh DB recommended):
    python backend/scripts/observe_flatline.py --polls 10 --interval 30
Output: JSON lines on stdout and in --out (default docs/phase0-observation.jsonl).
"""
import argparse
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone

API_DEFAULT = "http://127.0.0.1:8000"


def fetch_json(url: str, timeout: int = 30) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.load(resp)


def main() -> int:
    parser = argparse.ArgumentParser(description="Observe flatline behaviour live.")
    parser.add_argument("--polls", type=int, default=10)
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--lat", type=float, default=17.3850)
    parser.add_argument("--lon", type=float, default=78.4866)
    parser.add_argument("--api", default=API_DEFAULT)
    parser.add_argument("--out", default="docs/phase0-observation.jsonl")
    args = parser.parse_args()

    prev_values: dict[str, dict] = {}
    out = open(args.out, "w", encoding="utf-8")
    print(f"Observing {args.polls} polls every {args.interval}s "
          f"against {args.api} (centre {args.lat},{args.lon})", flush=True)
    try:
        for poll in range(1, args.polls + 1):
            started = time.time()
            record: dict = {
                "poll": poll,
                "wall_time_utc": datetime.now(timezone.utc).isoformat(),
            }
            try:
                upstream = fetch_json(
                    "https://api.open-meteo.com/v1/forecast"
                    f"?latitude={args.lat}&longitude={args.lon}"
                    "&current=temperature_2m,relative_humidity_2m,"
                    "surface_pressure&timezone=auto"
                )
                record["upstream_centre"] = upstream.get("current")
            except Exception as exc:  # noqa: BLE001 - observation must not die
                record["upstream_error"] = str(exc)

            try:
                payload = fetch_json(
                    f"{args.api}/api/v1/live-surrounding-stations"
                    f"?lat={args.lat}&lon={args.lon}&count=6"
                )
                stations = []
                for st in payload["stations"]:
                    sid = st["station_id"]
                    vals = {
                        "temperature": st["raw_temperature"],
                        "pressure": st["pressure"],
                        "humidity": st["humidity"],
                    }
                    changed = prev_values.get(sid) != vals
                    prev_values[sid] = vals
                    stations.append({
                        "station_id": sid,
                        **vals,
                        "values_changed_since_last_poll": changed,
                        "qc_flag": st["qc_flag"],
                        "flag_reason": st["flag_reason"],
                        "has_anomaly": st["has_anomaly"],
                        "repair_method": st["repair_method"],
                    })
                record["stations"] = stations
            except Exception as exc:  # noqa: BLE001
                record["api_error"] = str(exc)

            out.write(json.dumps(record) + "\n")
            out.flush()
            flags = ", ".join(
                f"{s['station_id']}:{s['qc_flag']}"
                for s in record.get("stations", [])
            )
            upstream_time = (record.get("upstream_centre") or {}).get("time")
            print(f"poll {poll}/{args.polls} upstream_time={upstream_time} "
                  f"flags=[{flags}]", flush=True)

            if poll < args.polls:
                time.sleep(max(0, args.interval - (time.time() - started)))
    finally:
        out.close()
    print(f"Done. Log written to {args.out}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
