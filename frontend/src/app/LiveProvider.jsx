import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LiveContext } from "./live-context";
import {
  getAlerts,
  getBackendHealth,
  getLiveStations,
  normalizeApiError,
} from "../services/api";
import { CENTER, CENTER_STATION_ID, KNOWN_STATIONS } from "../utils/stations";

const BASE_INTERVAL_MS = 30000;
const MAX_INTERVAL_MS = 120000;

/**
 * LiveProvider — the ONE polling loop in the app. Every page reads live
 * state from here; no component polls on its own.
 *
 * Each tick fetches, independently (allSettled, so a 502 on the live feed
 * does not hide a healthy backend):
 *   - GET /health            → backend + LSTM + database status
 *   - GET /live-surrounding-stations → the 6 live readings
 *   - GET /alerts?limit=10   → recent alerts for the activity feed
 *
 * On repeated live-feed failure the interval backs off (30s → 60s → 120s
 * max) and resets on the next success. The timeout chain is cleaned up on
 * unmount. A manual refresh always fires immediately.
 */
export function LiveProvider({ children }) {
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [stations, setStations] = useState([]);
  const [liveStatus, setLiveStatus] = useState("loading"); // loading | live | error | offline
  const [liveError, setLiveError] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsError, setAlertsError] = useState(null);
  const [lastPollAt, setLastPollAt] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const [selectedStationId, setSelectedStationId] =
    useState(CENTER_STATION_ID);

  const failuresRef = useRef(0);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const nextDelay = useCallback(
    () =>
      Math.min(BASE_INTERVAL_MS * 2 ** failuresRef.current, MAX_INTERVAL_MS),
    [],
  );

  const poll = useCallback(async () => {
    const [healthRes, liveRes, alertsRes] = await Promise.allSettled([
      getBackendHealth(),
      getLiveStations(CENTER.lat, CENTER.lon, 6),
      getAlerts({ limit: 10 }),
    ]);
    if (!mountedRef.current) return;

    const now = new Date();
    setLastPollAt(now);

    if (healthRes.status === "fulfilled") {
      setHealth(healthRes.value);
      setHealthError(null);
    } else {
      setHealth(null);
      setHealthError(normalizeApiError(healthRes.reason));
    }

    if (liveRes.status === "fulfilled") {
      setStations(liveRes.value.stations || []);
      setLiveError(null);
      setLiveStatus("live");
      setLastSuccessAt(now);
      failuresRef.current = 0;
    } else {
      const err = normalizeApiError(liveRes.reason);
      setLiveError(err);
      failuresRef.current += 1;
      // Backend unreachable entirely → offline; backend up but the live
      // feed failed (e.g. Open-Meteo 502) → error, stored data still works.
      setLiveStatus(
        healthRes.status === "fulfilled" ? "error" : "offline",
      );
    }

    if (alertsRes.status === "fulfilled") {
      setAlerts(alertsRes.value.alerts || []);
      setAlertsError(null);
    } else {
      setAlertsError(normalizeApiError(alertsRes.reason));
    }
  }, []);

  // One self-scheduling chain: poll, then wait (backed-off on failure).
  // Named function expression so the recursion is self-contained.
  const tick = useCallback(async function tickFn() {
    await poll();
    if (!mountedRef.current) return;
    timerRef.current = window.setTimeout(tickFn, nextDelay());
  }, [poll, nextDelay]);

  useEffect(() => {
    mountedRef.current = true;
    // Data-fetching effect: polling the backend synchronizes React with an
    // external system, which is what effects are for.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    tick();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [tick]);

  /** Immediate re-poll (refresh button), then resume the chain. */
  const refresh = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    tick();
  }, [tick]);

  const value = useMemo(() => {
    const liveById = new Map(stations.map((s) => [s.station_id, s]));
    // Directory: the known ring, merged with live readings when present.
    const directory = KNOWN_STATIONS.map((known) => ({
      ...known,
      live: liveById.get(known.station_id) || null,
    }));
    const selectedStation =
      directory.find((s) => s.station_id === selectedStationId) ||
      directory[0];

    const connection =
      liveStatus === "live"
        ? { state: "live", label: "Live" }
        : liveStatus === "error"
          ? { state: "degraded", label: "Live feed down" }
          : liveStatus === "offline"
            ? { state: "offline", label: "Backend offline" }
            : { state: "loading", label: "Connecting" };

    return {
      health,
      healthError,
      stations,
      liveStatus,
      liveError,
      alerts,
      alertsError,
      lastPollAt,
      lastSuccessAt,
      connection,
      directory,
      selectedStationId,
      setSelectedStationId,
      selectedStation,
      refresh,
    };
  }, [
    health,
    healthError,
    stations,
    liveStatus,
    liveError,
    alerts,
    alertsError,
    lastPollAt,
    lastSuccessAt,
    selectedStationId,
    refresh,
  ]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
