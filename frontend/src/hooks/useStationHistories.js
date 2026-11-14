import { useCallback, useEffect, useState } from "react";
import { getStationHistory, normalizeApiError } from "../services/api";
import { KNOWN_STATIONS } from "../utils/stations";

/**
 * useStationHistories — stored history for every known station, fetched in
 * parallel. Powers the station-card signal strips and the stored-data
 * fallback when the live feed is down. Partial failure is tolerated: a
 * station whose history fails keeps an empty list and the error is
 * reported, but the other stations still render.
 */
export function useStationHistories(limit = 24) {
  const [byId, setById] = useState({});
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setStatus("loading");
    setError(null);
    const results = await Promise.allSettled(
      KNOWN_STATIONS.map((s) => getStationHistory(s.station_id, limit)),
    );
    const next = {};
    let failures = 0;
    let firstError = null;
    results.forEach((result, i) => {
      const id = KNOWN_STATIONS[i].station_id;
      if (result.status === "fulfilled") {
        next[id] = result.value.observations || [];
      } else {
        next[id] = [];
        failures += 1;
        if (!firstError) firstError = normalizeApiError(result.reason);
      }
    });
    setById(next);
    if (failures === results.length) {
      setStatus("error");
      setError(firstError);
    } else {
      setStatus("ready");
      if (failures > 0) setError(firstError);
    }
  }, [limit]);

  useEffect(() => {
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  return { byId, status, error, refetch: fetchAll };
}

/** Latest stored observation for a station, or null. */
export function latestOf(observations) {
  if (!observations || observations.length === 0) return null;
  return observations[observations.length - 1];
}
