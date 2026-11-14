import { useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { stationShortLabel } from "../../utils/stations";
import { formatHumidity, formatPressure, formatTemp } from "../../utils/formatting";
import { formatDateTime, relativeTime } from "../../utils/time";

/**
 * WeatherMap — Leaflet map fitted to all six stations (40 km ring, zoom
 * ~10–11 once fitted). Markers are custom divIcons — no external images.
 * Clicking a marker selects the station everywhere (cards, charts).
 *
 * stations: [{station_id, latitude, longitude, reading, stale}]
 *   reading: live or latest stored StationReading (or null)
 *   stale: true when the reading is stored data, not a live poll
 */
function stationIcon({ anomaly, selected, stale, label }) {
  const classes = [
    "sg-marker",
    anomaly ? "sg-marker--anomaly" : "",
    selected ? "sg-marker--selected" : "",
    stale && !anomaly ? "sg-marker--stale" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return L.divIcon({
    className: "",
    html: `<div class="${classes}">${label}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

export default function WeatherMap({
  stations,
  selectedStationId,
  onSelect,
}) {
  const bounds = useMemo(() => {
    if (!stations.length) return null;
    return L.latLngBounds(
      stations.map((s) => [s.latitude, s.longitude]),
    );
  }, [stations]);

  if (!bounds) return null;

  return (
    <div className="h-[320px] w-full overflow-hidden rounded-xl border border-line sm:h-[420px]">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [32, 32] }}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
        aria-label="Map of the six SkyGuard stations around Hyderabad"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {stations.map((s) => {
          const reading = s.reading;
          const anomaly = Boolean(reading?.has_anomaly);
          const label =
            stationShortLabel(s.station_id) === "Centre"
              ? "C"
              : stationShortLabel(s.station_id).replace("Node ", "");
          return (
            <Marker
              key={s.station_id}
              position={[s.latitude, s.longitude]}
              icon={stationIcon({
                anomaly,
                selected: s.station_id === selectedStationId,
                stale: s.stale,
                label,
              })}
              eventHandlers={{ click: () => onSelect(s.station_id) }}
              keyboard
              title={s.name}
            >
              <Popup>
                <StationPopup station={s} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function StationPopup({ station }) {
  const r = station.reading;
  return (
    <div className="min-w-[180px] font-sans">
      <p className="text-sm font-semibold text-ink">{station.name}</p>
      <p className="font-mono text-xs text-muted">{station.station_id}</p>
      {r ? (
        <>
          <dl className="mt-2 flex flex-col gap-1 text-[13px] text-ink">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Temperature</dt>
              <dd className="tnum font-medium">{formatTemp(r.temperature)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Humidity</dt>
              <dd className="tnum font-medium">{formatHumidity(r.humidity)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Pressure</dt>
              <dd className="tnum font-medium">{formatPressure(r.pressure)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            {r.has_anomaly ? (
              <span className="font-medium text-coral-deep">
                Flagged: {r.flag_reason}
              </span>
            ) : (
              "Reading clean"
            )}
          </p>
          <p className="mt-1 text-xs text-muted">
            Observed {formatDateTime(r.observed_at || r.timestamp)} (
            {relativeTime(r.observed_at || r.timestamp)})
            {station.stale ? " · stored data" : ""}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-muted">
          No readings recorded for this station yet.
        </p>
      )}
    </div>
  );
}
