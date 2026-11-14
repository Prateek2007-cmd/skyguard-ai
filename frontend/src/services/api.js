import axios from "axios";

/**
 * SkyGuard API client. Base URL comes from VITE_API_BASE_URL (production:
 * backend origin + /api/v1); in dev the Vite proxy maps /api to the local
 * FastAPI server. See docs/api-contract.md — the contract is the source of
 * truth for every call here.
 */

const api = axios.create({
  // Optional chaining: import.meta.env exists under Vite; in plain Node
  // (unit checks) it is undefined and the default applies.
  baseURL: (import.meta.env?.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, ""),
  timeout: 30000,
});

/**
 * Normalise an axios failure into a plain object the UI can render.
 * kind: 'upstream' (Open-Meteo unreachable — 502, or a 5xx from a live
 *   endpoint), 'validation' (422 with field errors), 'not-found',
 *   'network' (no response at all), 'server', 'unknown'.
 */
export function normalizeApiError(error) {
  if (!error) {
    return { status: null, kind: "unknown", message: "Something went wrong." };
  }
  if (error.response) {
    const { status, data } = error.response;
    const detail = data?.detail;
    let message;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      // FastAPI validation errors: [{loc, msg}]
      message = detail
        .map((d) => `${d.loc?.slice(1).join(".") || "field"}: ${d.msg}`)
        .join("; ");
    } else {
      message = `Request failed with status ${status}.`;
    }
    if (status === 502 || status === 504) {
      return {
        status,
        kind: "upstream",
        message:
          "The upstream weather service (Open-Meteo) is unreachable or " +
          "rate-limited right now. Stored data is still available.",
      };
    }
    if (status === 500 || status === 503) {
      return {
        status,
        kind: "server",
        message:
          "The backend could not complete this request. It may depend on " +
          "live weather data that is currently unavailable.",
      };
    }
    if (status === 422) {
      return { status, kind: "validation", message };
    }
    if (status === 404) {
      return { status, kind: "not-found", message: "Not found." };
    }
    return { status, kind: "server", message };
  }
  if (error.request) {
    return {
      status: null,
      kind: "network",
      message:
        "Could not reach the SkyGuard backend. Check that the server is " +
        "running and try again.",
    };
  }
  return {
    status: null,
    kind: "unknown",
    message: error.message || "Something went wrong.",
  };
}

/** GET /health — {status, onnx_lstm_ready, database} */
export async function getBackendHealth() {
  const { data } = await api.get("/health");
  return data;
}

/**
 * GET /live-surrounding-stations — live readings for the 6 virtual stations
 * in a 40 km ring around (lat, lon). Returns 502 when Open-Meteo is
 * unreachable or rate-limited; callers must handle that as an error state.
 */
export async function getLiveStations(latitude, longitude, count = 6) {
  const { data } = await api.get("/live-surrounding-stations", {
    params: { lat: latitude, lon: longitude, count },
  });
  return data;
}

/** POST /anomalies/repair — re-run the pipeline on a supplied reading. */
export async function repairObservation(request) {
  const { data } = await api.post("/anomalies/repair", request);
  return data;
}

/**
 * GET /stations/{station_id}/history — stored DISTINCT observations,
 * oldest first (chart order). limit 1–500.
 */
export async function getStationHistory(stationId, limit = 120) {
  const { data } = await api.get(
    `/stations/${encodeURIComponent(stationId)}/history`,
    { params: { limit } },
  );
  return data;
}

/** GET /alerts — flagged observations, newest first. */
export async function getAlerts({ stationId, severity, limit = 50, offset = 0 } = {}) {
  const { data } = await api.get("/alerts", {
    params: {
      ...(stationId ? { station_id: stationId } : {}),
      ...(severity ? { severity } : {}),
      limit,
      offset,
    },
  });
  return data;
}

/** GET /alerts/{alert_id} — full detail incl. rule results and repair. */
export async function getAlertDetail(alertId) {
  const { data } = await api.get(`/alerts/${encodeURIComponent(alertId)}`);
  return data;
}

/**
 * POST /simulate — run a fault scenario through the real pipeline.
 * Nothing is persisted (simulated: true, persisted: false). The backend
 * validates steps >= 2 for every scenario, including single-step ones.
 */
export async function runSimulation(request) {
  const { data } = await api.post("/simulate", request, { timeout: 60000 });
  return data;
}

/** GET /health/summary — per-station health scores and method text. */
export async function getHealthSummary() {
  const { data } = await api.get("/health/summary");
  return data;
}

/**
 * GET /evaluation — metrics computed live from a seeded SYNTHETIC labelled
 * set. Never hardcode these values; always fetch.
 */
export async function getEvaluation({ seed = 42, nCases = 240 } = {}) {
  const { data } = await api.get("/evaluation", {
    params: { seed, n_cases: nCases },
  });
  return data;
}
