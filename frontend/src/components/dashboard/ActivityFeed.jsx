import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";
import Card, { CardHeader } from "../ui/Card";
import Badge from "../ui/Badge";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Skeleton from "../ui/Skeleton";
import { stationDisplayName } from "../../utils/stations";
import { formatDateTime, relativeTime } from "../../utils/time";

/**
 * ActivityFeed — recent alerts from the real alert record (GET /alerts),
 * newest first. Severity comes from the backend's triage label.
 */
const severityTone = { high: "alert", medium: "info", low: "neutral" };

export default function ActivityFeed({ alerts, status, error, onRetry }) {
  return (
    <Card variant="glass-subtle" className="flex h-full flex-col">
      <CardHeader
        title="Activity"
        description="Latest flagged readings across all stations."
      />
      <div className="-mx-1 flex-1 overflow-y-auto px-1">
        {status === "loading" ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : status === "error" ? (
          <ErrorState
            title="Could not load activity"
            message={error?.message}
            onRetry={onRetry}
          />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No alerts yet"
            description="No readings have been flagged. When the pipeline catches a faulty sensor, it appears here first."
          />
        ) : (
          <ol className="flex flex-col">
            {alerts.map((alert, i) => (
              <li
                key={alert.id}
                className={
                  i === alerts.length - 1
                    ? "py-1"
                    : "border-b border-line py-1"
                }
              >
                <Link
                  to={`/app/anomalies?alert=${encodeURIComponent(alert.id)}`}
                  className="block rounded-lg px-2 py-2 transition-colors hover:bg-mist"
                  aria-label={`${stationDisplayName(alert.station_id)}: ${alert.root_cause?.label || alert.flag_reason}. View details.`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-sm font-medium leading-snug text-ink">
                      {stationDisplayName(alert.station_id)}
                    </span>
                    <Badge tone={severityTone[alert.severity] || "neutral"}>
                      {alert.severity}
                    </Badge>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-muted">
                    {alert.root_cause?.label || alert.flag_reason}
                  </span>
                  <span className="tnum mt-1 block font-mono text-xs text-muted">
                    {formatDateTime(alert.observed_at || alert.timestamp)} ·{" "}
                    {relativeTime(alert.observed_at || alert.timestamp)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
