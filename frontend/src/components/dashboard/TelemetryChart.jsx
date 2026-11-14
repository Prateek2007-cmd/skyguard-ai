import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card, { CardHeader } from "../ui/Card";
import Tabs from "../ui/Tabs";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Skeleton from "../ui/Skeleton";
import { ChartLine } from "lucide-react";
import { KNOWN_STATIONS, stationDisplayName } from "../../utils/stations";
import { formatDateTime } from "../../utils/time";
import { PARAMETERS, RANGES } from "./telemetry-config";

/**
 * TelemetryChart — temperature / humidity / pressure for one station,
 * fed by the HISTORY endpoint (survives refresh) with live polls appended.
 * Two lines: the raw sensor value (ink) and the final repaired value
 * (instrument blue, dashed) — when they diverge, a repair happened.
 * Coral dots mark flagged observations.
 */

function AnomalyDot(props) {
  const { cx, cy, payload } = props;
  if (!payload?.anomaly) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill="#e87565" stroke="#ffffff" strokeWidth={1.5} />
    </g>
  );
}

function ChartTooltip({ active, payload, label, parameter }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const fmt = (v) =>
    typeof v === "number" ? `${v.toFixed(parameter.decimals)}${parameter.unit}` : "—";
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-[var(--shadow-lift)]">
      <p className="font-mono text-xs text-muted">{label}</p>
      <p className="tnum mt-1 text-sm text-ink">
        Raw <span className="font-semibold">{fmt(point[parameter.rawKey])}</span>
        {" · "}Final{" "}
        <span className="font-semibold">{fmt(point[parameter.finalKey])}</span>
      </p>
      {point.anomaly ? (
        <p className="mt-1 max-w-[260px] text-xs leading-snug text-coral-deep">
          {point.flag_reason}
        </p>
      ) : null}
      {point.live ? (
        <p className="mt-1 text-xs text-instrument-deep">Live reading</p>
      ) : null}
    </div>
  );
}

export default function TelemetryChart({
  points,
  parameter,
  onParameterChange,
  stationId,
  onStationChange,
  range,
  onRangeChange,
  status,
  error,
  onRetry,
}) {
  const param = PARAMETERS.find((p) => p.id === parameter) || PARAMETERS[0];

  return (
    <Card>
      <CardHeader
        title="Telemetry"
        description="Raw sensor values against the final repaired values. A gap between the two lines is a repair; a coral dot is a flagged observation."
        action={
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="telemetry-station">
              Station
            </label>
            <select
              id="telemetry-station"
              value={stationId}
              onChange={(e) => onStationChange(e.target.value)}
              className="h-10 rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-ink"
            >
              {KNOWN_STATIONS.map((s) => (
                <option key={s.station_id} value={s.station_id}>
                  {s.name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="telemetry-range">
              Time range
            </label>
            <select
              id="telemetry-range"
              value={range}
              onChange={(e) => onRangeChange(e.target.value)}
              className="h-10 rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-ink"
            >
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <Tabs
        items={PARAMETERS.map((p) => ({ id: p.id, label: p.label }))}
        value={parameter}
        onChange={onParameterChange}
        label="Telemetry parameter"
        className="mb-4"
      />

      <div
        role="tabpanel"
        id={`panel-${parameter}`}
        aria-labelledby={`tab-${parameter}`}
      >
      {status === "loading" ? (
        <Skeleton className="h-[280px] w-full" />
      ) : status === "error" ? (
        <ErrorState
          title="Could not load telemetry"
          message={error?.message}
          onRetry={onRetry}
        />
      ) : points.length === 0 ? (
        <EmptyState
          icon={ChartLine}
          title="No readings in this range"
          description={`Nothing stored for ${stationDisplayName(stationId)} in the selected range. Try a wider range, or another station.`}
        />
      ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#101d2b" strokeOpacity={0.06} vertical={false} />
              <XAxis
                dataKey="timeLabel"
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#101d2b", strokeOpacity: 0.12 }}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => `${v}${param.unit}`}
              />
              <Tooltip
                content={<ChartTooltip parameter={param} />}
                cursor={{ stroke: "#101d2b", strokeOpacity: 0.15 }}
              />
              <Line
                type="monotone"
                dataKey={param.rawKey}
                name="Raw"
                stroke="#101d2b"
                strokeWidth={1.75}
                dot={<AnomalyDot />}
                activeDot={{ r: 4, fill: "#101d2b", stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey={param.finalKey}
                name="Final"
                stroke="#267da8"
                strokeWidth={1.75}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, fill: "#267da8", stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-xs text-muted">
            {points.length} readings · {formatDateTime(points[0].observedAt)} –{" "}
            {formatDateTime(points[points.length - 1].observedAt)}
          </p>
        </div>
      )}
      </div>
    </Card>
  );
}
