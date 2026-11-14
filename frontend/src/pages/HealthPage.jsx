import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import Card, { CardHeader } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Eyebrow from "../components/ui/Eyebrow";
import MetricCard from "../components/ui/MetricCard";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Skeleton from "../components/ui/Skeleton";
import { getHealthSummary, normalizeApiError } from "../services/api";
import { stationDisplayName } from "../utils/stations";
import { formatDateTime, relativeTime } from "../utils/time";
import { formatGapMinutes, formatPercent01 } from "../utils/formatting";

const priorityTone = { high: "alert", medium: "info", low: "healthy" };
const priorityOrder = { high: 0, medium: 1, low: 2 };

/**
 * Sensor Health — per-station health from GET /health/summary: scores,
 * anomaly frequency, repeated-reading runs, freshness, per-parameter
 * breakdowns and maintenance priority. The method/formula text is shown
 * verbatim: the score is a documented heuristic triage, not a prediction.
 */
export default function HealthPage() {
  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: null,
  });

  const fetchSummary = async () => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const data = await getHealthSummary();
      setState({ status: "ready", data, error: null });
    } catch (error) {
      setState((s) => ({
        ...s,
        status: "error",
        error: normalizeApiError(error),
      }));
    }
  };

  // Data-fetching effect: loading the health summary on mount.
  useEffect(() => {
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    fetchSummary();
  }, []);

  const stations = [...(state.data?.stations || [])].sort(
    (a, b) =>
      (priorityOrder[a.maintenance_priority] ?? 9) -
        (priorityOrder[b.maintenance_priority] ?? 9) ||
      a.health_score - b.health_score,
  );

  const staleCount = stations.filter((s) => s.freshness?.is_stale).length;
  const totalAnomalies = stations.reduce((sum, s) => sum + (s.anomalies || 0), 0);
  const avgScore =
    stations.length > 0
      ? Math.round(
          stations.reduce((sum, s) => sum + (s.health_score || 0), 0) /
            stations.length,
        )
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-2">Maintenance triage</Eyebrow>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Sensor Health
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
          Which stations need a visit, and why. Scores come from the stored
          record — anomaly frequency, repeated readings and freshness — and
          are a triage heuristic, not a failure prediction.
        </p>
      </div>

      {state.status === "loading" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state.status === "error" ? (
        <Card>
          <ErrorState
            title="Could not load sensor health"
            message={state.error?.message}
            onRetry={fetchSummary}
          />
        </Card>
      ) : stations.length === 0 ? (
        <Card>
          <EmptyState
            icon={HeartPulse}
            title="No stations observed yet"
            description="Health scores appear once the backend has recorded readings for the stations."
          />
        </Card>
      ) : (
        <>
          <section
            aria-label="Health overview"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <MetricCard
              label="Stations observed"
              value={String(state.data?.stations_observed ?? stations.length)}
              sub="Virtual nodes with stored readings."
            />
            <MetricCard
              label="Average health score"
              value={avgScore !== null ? String(avgScore) : "—"}
              sub="Out of 100, across all stations."
              tone="accent"
            />
            <MetricCard
              label="Anomalies in the record"
              value={String(totalAnomalies)}
              sub={
                staleCount > 0
                  ? `${staleCount} station${staleCount === 1 ? " is" : "s are"} stale.`
                  : "No station is stale right now."
              }
              tone={totalAnomalies > 0 ? "alert" : "healthy"}
            />
          </section>

          <section
            aria-label="Per-station health"
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            {stations.map((station) => (
              <HealthStationCard key={station.station_id} station={station} />
            ))}
          </section>

          {state.data?.method ? (
            <Card>
              <CardHeader
                title="How the score is calculated"
                description="The method, as documented by the backend. Read it before acting on a score."
              />
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1 border-b border-line pb-3 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 font-medium text-ink">Health score</dt>
                  <dd className="leading-relaxed text-muted">
                    {state.data.method.health_score}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 border-b border-line pb-3 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 font-medium text-ink">
                    Maintenance priority
                  </dt>
                  <dd className="leading-relaxed text-muted">
                    {state.data.method.maintenance_priority}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                  <dt className="w-44 shrink-0 font-medium text-ink">
                    Stale threshold
                  </dt>
                  <dd className="leading-relaxed text-muted">
                    {state.data.method.stale_threshold_minutes} minutes without
                    a distinct observation.
                  </dd>
                </div>
              </dl>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function HealthStationCard({ station }) {
  const score = station.health_score ?? 0;
  const scoreTone =
    score < 50 ? "bg-coral" : score < 75 ? "bg-instrument" : "bg-healthy";
  const params = station.per_parameter_anomalies || {};

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">
            {stationDisplayName(station.station_id)}
          </h2>
          <p className="font-mono text-xs text-muted">{station.station_id}</p>
        </div>
        <Badge tone={priorityTone[station.maintenance_priority] || "neutral"}>
          {station.maintenance_priority} priority
        </Badge>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <span className="tnum text-[32px] font-semibold leading-none tracking-tight text-ink">
          {score}
        </span>
        <span className="pb-0.5 text-sm text-muted">/ 100 health score</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-mist"
        role="img"
        aria-label={`Health score ${score} out of 100`}
      >
        <div
          className={`h-full rounded-full ${scoreTone}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Readings</dt>
          <dd className="tnum mt-0.5 font-semibold text-ink">
            {station.readings}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Anomalies</dt>
          <dd className="tnum mt-0.5 font-semibold text-ink">
            {station.anomalies} ({formatPercent01(station.anomaly_rate)})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Longest repeated run</dt>
          <dd className="tnum mt-0.5 font-semibold text-ink">
            {station.longest_repeated_run} reading
            {station.longest_repeated_run === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Freshness</dt>
          <dd className="tnum mt-0.5 font-semibold text-ink">
            {station.freshness?.is_stale ? (
              <span className="text-coral-deep">
                Stale · {formatGapMinutes(station.freshness.gap_minutes)}
              </span>
            ) : (
              `Fresh · ${formatGapMinutes(station.freshness?.gap_minutes)} ago`
            )}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Last observed</dt>
          <dd className="tnum mt-0.5 font-semibold text-ink">
            {formatDateTime(station.last_observed_at)} (
            {relativeTime(station.last_observed_at)})
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-[13px] font-semibold text-ink">
          Anomalies by parameter
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[
            ["Temperature", params.temperature],
            ["Pressure", params.pressure],
            ["Humidity", params.humidity],
            ["Spatial", params.spatial],
          ].map(([label, count]) => (
            <div key={label} className="rounded-lg bg-mist px-2 py-2.5">
              <p className="tnum text-lg font-semibold leading-none text-ink">
                {count ?? 0}
              </p>
              <p className="mt-1 text-xs leading-tight text-muted">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
