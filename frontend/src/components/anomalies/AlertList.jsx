import Badge from "../ui/Badge";
import { stationDisplayName } from "../../utils/stations";
import { formatDateTime, relativeTime } from "../../utils/time";
import { formatTemp } from "../../utils/formatting";

const severityTone = { high: "alert", medium: "info", low: "neutral" };

/**
 * AlertList — the alert record, newest first. Each row is a button that
 * selects the alert for the detail panel. Severity and root cause come
 * from the backend's triage, never invented here.
 */
export default function AlertList({ alerts, selectedId, onSelect }) {
  return (
    <ol className="flex flex-col" aria-label="Alerts">
      {alerts.map((alert, i) => {
        const selected = alert.id === selectedId;
        return (
          <li
            key={alert.id}
            className={i === alerts.length - 1 ? "" : "border-b border-line"}
          >
            <button
              type="button"
              onClick={() => onSelect(alert.id)}
              aria-current={selected}
              className={[
                "w-full px-4 py-3.5 text-left",
                "transition-[background-color,box-shadow] duration-150",
                selected
                  ? "bg-vermilion-wash shadow-[inset_3px_0_0_var(--color-vermilion)]"
                  : "hover:bg-mist",
              ].join(" ")}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 text-sm font-semibold leading-snug text-ink">
                  {stationDisplayName(alert.station_id)}
                </span>
                <Badge tone={severityTone[alert.severity] || "neutral"}>
                  {alert.severity}
                </Badge>
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-ink-soft">
                {alert.root_cause?.label || alert.flag_reason}
              </span>
              <span className="tnum mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs text-muted">
                <span>
                  {formatDateTime(alert.observed_at || alert.timestamp)} ·{" "}
                  {relativeTime(alert.observed_at || alert.timestamp)}
                </span>
                <span>
                  Raw {formatTemp(alert.raw_temperature)} →{" "}
                  {formatTemp(alert.temperature)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
