/**
 * Station geometry and display names.
 *
 * The six stations are VIRTUAL nodes on live Open-Meteo data, arranged by
 * the backend as a 40 km ring around Hyderabad (17.385, 78.4866): one
 * central node plus five surrounding nodes at 72° steps. This module
 * replicates the backend's published ring formula (backend/app/api/routes.py
 * `_surrounding_coordinates`) so the map and the simulation form know where
 * the stations sit even when the live endpoint is down. Positions and names
 * are layout facts; every measured value always comes from the API.
 */

export const CENTER = { lat: 17.385, lon: 78.4866 };
export const RING_RADIUS_KM = 40;
export const STATION_COUNT = 6;

export const CENTER_STATION_ID = "AWS_CENTER_0";

/** Replicates the backend ring formula exactly (rounded to 4 dp). */
export function ringStations(center = CENTER, count = STATION_COUNT) {
  const stations = [
    {
      station_id: CENTER_STATION_ID,
      name: "Central AWS Node",
      latitude: center.lat,
      longitude: center.lon,
    },
  ];
  const lonScale = Math.max(Math.abs(Math.cos((center.lat * Math.PI) / 180)), 1e-6);
  for (let index = 1; index < count; index += 1) {
    const angle = ((2 * Math.PI) / (count - 1)) * (index - 1);
    const deltaLat = (RING_RADIUS_KM / 111) * Math.cos(angle);
    const deltaLon =
      (RING_RADIUS_KM / (111 * lonScale)) * Math.sin(angle);
    stations.push({
      station_id: `AWS_DYNAMIC_${String(index).padStart(2, "0")}`,
      name: `Surrounding Node ${index}`,
      latitude: Math.round((center.lat + deltaLat) * 10000) / 10000,
      longitude: Math.round((center.lon + deltaLon) * 10000) / 10000,
    });
  }
  return stations;
}

export const KNOWN_STATIONS = ringStations();

const BY_ID = new Map(KNOWN_STATIONS.map((s) => [s.station_id, s]));

export function stationById(stationId) {
  return BY_ID.get(stationId) || null;
}

/** Human display name for a station id; falls back to a prettified id. */
export function stationDisplayName(stationId) {
  const known = BY_ID.get(stationId);
  if (known) return known.name;
  if (!stationId) return "Unknown station";
  return stationId.replace(/^AWS_/, "").replace(/_/g, " ");
}

/** Short label used on the map and in compact lists. */
export function stationShortLabel(stationId) {
  if (stationId === CENTER_STATION_ID) return "Centre";
  const match = /^AWS_DYNAMIC_(\d+)$/.exec(stationId || "");
  if (match) return `Node ${Number(match[1])}`;
  return stationDisplayName(stationId);
}
