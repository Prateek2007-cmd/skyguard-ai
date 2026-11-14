import Badge from "../ui/Badge";
import SignalStrip from "./SignalStrip";
import { formatHumidity, formatPressure, formatTemp } from "../../utils/formatting";
import { relativeTime } from "../../utils/time";

/**
 * StationCard — one station at a glance: name, live (or latest stored)
 * readings, health, last update, anomaly state, and a mini signal strip
 * from stored history. The whole card is a button: activating it selects
 * the station everywhere (map, charts).
 */
export default function StationCard({
  station,
  reading,
  history,
  selected,
  stale,
  onSelect,
}) {
  const anomaly = Boolean(reading?.has_anomaly);
  const observedAt = reading?.observed_at || reading?.timestamp;

  const stripPoints = (history || []).map((o) => ({
    value: o.temperature,
    anomaly: o.has_anomaly,
  }));

  return (
    <button
      type="button"
      onClick={() => onSelect(station.station_id)}
      aria-pressed={selected}
      aria-label={`${station.name}: ${reading ? formatTemp(reading.temperature) : "no readings"}${
        anomaly ? ", flagged anomaly" : ""
      }`}
      className={[
        "glass glass-hover w-full rounded-2xl p-4 text-left",
        selected ? "glass--selected" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold leading-snug text-ink">
            {station.name}
          </h3>
          <p className="truncate font-mono text-xs text-muted">
            {station.station_id}
          </p>
        </div>
        {reading ? (
          <Badge tone={anomaly ? "alert" : "healthy"}>
            {anomaly ? "Attention" : "Healthy"}
          </Badge>
        ) : (
          <Badge tone="neutral">No data</Badge>
        )}
      </div>

      {reading ? (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="tnum text-[28px] font-semibold leading-none tracking-tight text-ink">
              {formatTemp(reading.temperature)}
            </span>
            <span className="tnum text-[13px] text-muted">
              {formatHumidity(reading.humidity)} · {formatPressure(reading.pressure)}
            </span>
          </div>
          {anomaly ? (
            <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-coral-deep">
              {reading.flag_reason}
            </p>
          ) : (
            <p className="mt-2 text-[13px] leading-snug text-muted">
              {reading.flag_reason || "All checks passed."}
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          No readings recorded for this station yet.
        </p>
      )}

      {stripPoints.length >= 2 ? (
        <div className="mt-3 border-t border-line pt-3">
          <SignalStrip
            points={stripPoints}
            height={44}
            flagRadius={3}
            label={`Temperature trace for ${station.name}, ${stripPoints.length} stored readings`}
          />
        </div>
      ) : null}

      <p className="tnum mt-3 text-xs text-muted">
        {observedAt
          ? `Observed ${relativeTime(observedAt)}${stale ? " · stored data" : ""}`
          : "Never observed"}
      </p>
    </button>
  );
}
