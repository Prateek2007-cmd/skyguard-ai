import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useLive } from "../app/live-context";
import { useStationHistories, latestOf } from "../hooks/useStationHistories";
import { getStationHistory, normalizeApiError } from "../services/api";
import { parseApiTime, formatTime, formatDateTime, relativeTime } from "../utils/time";
import { KNOWN_STATIONS } from "../utils/stations";
import MetricCard from "../components/ui/MetricCard";
import Eyebrow from "../components/ui/Eyebrow";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card, { CardHeader } from "../components/ui/Card";
import Skeleton from "../components/ui/Skeleton";
import StationCard from "../components/dashboard/StationCard";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import { RANGES } from "../components/dashboard/telemetry-config";

// Leaflet and Recharts are the two heavy dependencies; they load on demand
// so the first paint stays light.
const WeatherMap = lazy(() => import("../components/dashboard/WeatherMap"));
const TelemetryChart = lazy(
  () => import("../components/dashboard/TelemetryChart"),
);

/**
 * Command Center — live overview of the six stations.
 *
 * Data honesty: readings come from the live poll when the feed is up.
 * When it is down (Open-Meteo unreachable), cards and the map fall back to
 * the latest STORED observation per station and say so — the banner and
 * the "stored data" labels make the source unmistakable. Nothing is faked.
 */
export default function CommandCenterPage() {
  const {
    health,
    liveStatus,
    liveError,
    stations: liveStations,
    alerts,
    alertsError,
    lastSuccessAt,
    selectedStationId,
    setSelectedStationId,
    refresh,
  } = useLive();

  const histories = useStationHistories(24);

  const [chartParameter, setChartParameter] = useState("temperature");
  const [chartRange, setChartRange] = useState("24h");
  const [chartHistory, setChartHistory] = useState([]);
  const [chartStatus, setChartStatus] = useState("loading");
  const [chartError, setChartError] = useState(null);

  // Chart history: the selected station's stored observations (limit 120),
  // re-fetched when the selection changes. Survives refresh; live polls
  // are appended below.
  useEffect(() => {
    let active = true;
    // Data-fetching effect: loading stored history for the selected station.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    setChartStatus("loading");
    setChartError(null);
    getStationHistory(selectedStationId, 120)
      .then((data) => {
        if (!active) return;
        setChartHistory(data.observations || []);
        setChartStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setChartStatus("error");
        setChartError(normalizeApiError(error));
      });
    return () => {
      active = false;
    };
  }, [selectedStationId]);

  const liveById = useMemo(
    () => new Map(liveStations.map((s) => [s.station_id, s])),
    [liveStations],
  );
  const isLive = liveStatus === "live";

  // One reading per station: live when the feed is up, else the latest
  // stored observation. `stale` marks the stored-data fallback.
  // Positions prefer the live reading's coordinates (authoritative) and
  // fall back to the ring formula when the feed is down.
  const stationViews = useMemo(
    () =>
      KNOWN_STATIONS.map((station) => {
        const live = isLive ? liveById.get(station.station_id) : undefined;
        const stored = latestOf(histories.byId[station.station_id]);
        return {
          ...station,
          latitude: live?.latitude ?? station.latitude,
          longitude: live?.longitude ?? station.longitude,
          reading: live || stored || null,
          stale: !live,
          history: histories.byId[station.station_id] || [],
        };
      }),
    [isLive, liveById, histories.byId],
  );

  const reporting = stationViews.filter((s) => s.reading).length;
  const healthy = stationViews.filter(
    (s) => s.reading && !s.reading.has_anomaly,
  ).length;
  const attention = stationViews.filter(
    (s) => s.reading?.has_anomaly,
  ).length;

  // Freshest reading across stations, for the "last update" metric with
  // the observed_at vs fetched_at distinction.
  const freshest = useMemo(() => {
    let best = null;
    let bestTime = 0;
    for (const s of stationViews) {
      const t = parseApiTime(s.reading?.observed_at || s.reading?.timestamp);
      if (t && t.getTime() > bestTime) {
        bestTime = t.getTime();
        best = s.reading;
      }
    }
    return best;
  }, [stationViews]);

  const chartPoints = useMemo(() => {
    const toPoint = (o, live = false) => ({
      t: parseApiTime(o.observed_at || o.timestamp)?.getTime() || 0,
      timeLabel: formatTime(o.observed_at || o.timestamp),
      observedAt: o.observed_at || o.timestamp,
      raw_temperature: o.raw_temperature,
      temperature: o.temperature,
      raw_pressure: o.raw_pressure,
      pressure: o.pressure,
      raw_humidity: o.raw_humidity,
      humidity: o.humidity,
      anomaly: o.has_anomaly,
      flag_reason: o.flag_reason,
      live,
    });
    let points = chartHistory.map((o) => toPoint(o));
    const range = RANGES.find((r) => r.id === chartRange) || RANGES[1];
    if (Number.isFinite(range.ms) && points.length > 0) {
      const maxT = Math.max(...points.map((p) => p.t));
      points = points.filter((p) => p.t >= maxT - range.ms);
    }
    if (isLive) {
      const live = liveById.get(selectedStationId);
      if (live) {
        const livePoint = toPoint(live, true);
        const last = points[points.length - 1];
        if (!last || livePoint.t > last.t) points = [...points, livePoint];
      }
    }
    return points;
  }, [chartHistory, chartRange, isLive, liveById, selectedStationId]);

  const feedStatus =
    liveStatus === "loading" ? "loading" : alertsError ? "error" : "ready";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-2">Network status</Eyebrow>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Live overview
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
          Six virtual weather stations in a 40&nbsp;km ring around Hyderabad,
          checked every 30 seconds. Readings flagged by the rule engine,
          spatial check or LSTM are repaired before they reach the record.
        </p>
      </div>

      {liveStatus === "error" || liveStatus === "offline" ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-coral/30 bg-coral-wash px-4 py-3 sm:flex-row sm:items-center"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-coral-deep" aria-hidden />
            <p className="min-w-0 flex-1 text-sm leading-snug text-ink">
              <span className="font-semibold">Live feed unavailable.</span>{" "}
              {liveError?.message ||
                "Showing the latest stored readings instead."}{" "}
              Stored data below is real; live values return when the upstream
              service answers.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={refresh} className="self-start sm:self-auto">
            Retry now
          </Button>
        </div>
      ) : null}

      <section
        aria-label="Overview metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <MetricCard
          label="Stations reporting"
          value={`${reporting} of 6`}
          sub={
            isLive
              ? "Live readings from all six virtual nodes."
              : "Latest stored reading per station."
          }
          tone="accent"
        />
        <MetricCard
          label="Healthy"
          value={String(healthy)}
          sub={
            healthy === 6
              ? "Every station reading clean."
              : `${healthy} station${healthy === 1 ? "" : "s"} passing all checks.`
          }
          tone="healthy"
        />
        <MetricCard
          label="Needs attention"
          value={String(attention)}
          sub={
            attention === 0
              ? "No station flagged right now."
              : `${attention} station${attention === 1 ? "" : "s"} flagged by the pipeline.`
          }
          tone={attention > 0 ? "alert" : "healthy"}
        />
        <MetricCard
          label="Last update"
          value={
            freshest
              ? relativeTime(freshest.observed_at || freshest.timestamp)
              : "—"
          }
          sub={
            freshest
              ? isLive && freshest.fetched_at
                ? `Observed ${formatTime(freshest.observed_at)} · fetched ${formatTime(freshest.fetched_at)}`
                : `Observed ${formatDateTime(freshest.observed_at)} · recorded ${formatTime(freshest.timestamp)}`
              : lastSuccessAt
                ? `Last good poll ${relativeTime(lastSuccessAt)}.`
                : "No readings yet."
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card variant="glass-subtle" className="min-w-0 lg:col-span-3" padding="p-4 sm:p-5">
          <CardHeader
            title="Station map"
            description="The 40 km ring around Hyderabad. Select a marker to follow that station in the cards and charts below."
          />
          <Suspense fallback={<Skeleton className="h-[320px] w-full sm:h-[420px]" />}>
            <WeatherMap
              stations={stationViews}
              selectedStationId={selectedStationId}
              onSelect={setSelectedStationId}
            />
          </Suspense>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Markers show each station&apos;s latest reading — green is clean,
            coral is flagged, grey is stored data while the live feed is down.
          </p>
        </Card>
        <div className="min-w-0 lg:col-span-2">
          <ActivityFeed
            alerts={alerts}
            status={feedStatus}
            error={alertsError}
            onRetry={refresh}
          />
        </div>
      </section>

      <section aria-label="Station explorer">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Station explorer</h2>
          <p className="text-[13px] text-muted">
            Select a station to follow it in the telemetry chart.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stationViews.map((s) => (
            <StationCard
              key={s.station_id}
              station={s}
              reading={s.reading}
              history={s.history}
              stale={s.stale}
              selected={s.station_id === selectedStationId}
              onSelect={setSelectedStationId}
            />
          ))}
        </div>
      </section>

      <Suspense fallback={<Skeleton className="h-[380px] w-full" />}>
        <TelemetryChart
          points={chartPoints}
          parameter={chartParameter}
          onParameterChange={setChartParameter}
          stationId={selectedStationId}
          onStationChange={setSelectedStationId}
          range={chartRange}
          onRangeChange={setChartRange}
          status={chartStatus}
          error={chartError}
          onRetry={() => {
            setChartStatus("loading");
            getStationHistory(selectedStationId, 120)
              .then((data) => {
                setChartHistory(data.observations || []);
                setChartStatus("ready");
              })
              .catch((error) => {
                setChartStatus("error");
                setChartError(normalizeApiError(error));
              });
          }}
        />
      </Suspense>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <span className="text-[13px] text-muted">System:</span>
        <Badge tone={health?.status === "online" ? "healthy" : "alert"}>
          Backend {health?.status || "offline"}
        </Badge>
        <Badge tone={health?.onnx_lstm_ready ? "healthy" : "neutral"}>
          ONNX LSTM {health?.onnx_lstm_ready ? "ready" : "unavailable"}
        </Badge>
        <Badge tone={health?.database === "connected" ? "healthy" : "neutral"}>
          Database {health?.database || "unknown"}
        </Badge>
        <span className="text-[13px] text-muted">
          · Polling every 30 seconds{isLive ? "" : " · live feed down, showing stored data"}
        </span>
      </div>
    </div>
  );
}
