import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Check, FlaskConical, X } from "lucide-react";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import { evidenceNoteBody, formatDelta, formatGapMinutes, formatHumidity, formatPressure, formatTemp, qcFlagLabel, repairMethodLabel } from "../../utils/formatting";
import { formatDateTime } from "../../utils/time";
import { stationDisplayName } from "../../utils/stations";
import { scenarioById } from "./scenarios";

/**
 * SimulationResults — what the pipeline did with the injected fault.
 * Every simulated observation is labelled "Simulated", and the panel
 * states "Not persisted to live records". Evidence scores are labelled
 * "Heuristic evidence score — not a model probability", per the contract.
 */
export default function SimulationResults({ result }) {
  const scenario = scenarioById(result.scenario);
  const steps = result.steps || [];
  const isDropout = result.scenario === "dropout";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">Simulated</Badge>
        <Badge tone="neutral">Not persisted to live records</Badge>
        <Badge tone={result.summary?.detected ? "alert" : "healthy"}>
          {result.summary?.detected ? "Fault detected" : "Not detected"}
        </Badge>
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {scenario.name} · {stationDisplayName(result.station_id)}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {result.summary?.message}
          {typeof result.summary?.steps_flagged === "number" &&
          typeof result.summary?.steps_total === "number"
            ? ` ${result.summary.steps_flagged} of ${result.summary.steps_total} injected steps flagged.`
            : ""}
        </p>
      </div>

      <BaselineCard baseline={result.baseline} />

      {isDropout ? (
        <DropoutCard gap={result.gap_analysis} />
      ) : (
        <>
          {steps.length >= 2 ? (
            <BeforeAfterChart steps={steps} />
          ) : steps.length === 1 ? (
            <BeforeAfterTable step={steps[0]} baseline={result.baseline} />
          ) : null}
          <ol className="flex flex-col gap-4">
            {steps.map((step) => (
              <li key={step.step}>
                <StepCard step={step} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function BaselineCard({ baseline }) {
  if (!baseline) return null;
  return (
    <Card padding="p-4">
      <h3 className="text-sm font-semibold text-ink">Live baseline at run time</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        The injected fault was built on the real current reading for this
        station — the same live data the pipeline judges every day.
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
        <div>
          <dt className="text-xs text-muted">Temperature</dt>
          <dd className="tnum mt-0.5 text-sm font-semibold text-ink">
            {formatTemp(baseline.temperature)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Humidity</dt>
          <dd className="tnum mt-0.5 text-sm font-semibold text-ink">
            {formatHumidity(baseline.humidity)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Pressure</dt>
          <dd className="tnum mt-0.5 text-sm font-semibold text-ink">
            {formatPressure(baseline.pressure)}
          </dd>
        </div>
      </dl>
      {baseline.observed_at ? (
        <p className="tnum mt-2 font-mono text-xs text-muted">
          Observed {formatDateTime(baseline.observed_at)}
        </p>
      ) : null}
    </Card>
  );
}

function DropoutCard({ gap }) {
  if (!gap) return null;
  return (
    <Card padding="p-4">
      <h3 className="text-sm font-semibold text-ink">Freshness gap analysis</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Badge tone={gap.is_stale ? "alert" : "healthy"}>
          {gap.is_stale ? "Station is stale" : "Station is reporting"}
        </Badge>
        <span className="tnum text-sm text-ink">
          Gap: {formatGapMinutes(gap.gap_minutes)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{gap.reason}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {gap.explanation}
      </p>
    </Card>
  );
}

function BeforeAfterChart({ steps }) {
  const data = steps.map((s) => ({
    step: `Step ${s.step}`,
    injected: s.injected?.temperature,
    repaired: s.repaired?.temperature,
  }));
  return (
    <Card padding="p-4">
      <h3 className="text-sm font-semibold text-ink">
        Injected vs repaired temperature
      </h3>
      <div className="mt-3 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#101d2b" strokeOpacity={0.06} vertical={false} />
            <XAxis
              dataKey="step"
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={{ stroke: "#101d2b", strokeOpacity: 0.12 }}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 12, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => `${v}°C`}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid rgb(16 29 43 / 0.1)",
                fontSize: 13,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="injected"
              name="Injected"
              stroke="#101d2b"
              strokeWidth={2}
              dot={{ r: 3, fill: "#101d2b" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="repaired"
              name="Repaired"
              stroke="#267da8"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function BeforeAfterTable({ step, baseline }) {
  const rows = [
    {
      label: "Temperature",
      injected: formatTemp(step.injected?.temperature),
      repaired: formatTemp(step.repaired?.temperature),
      delta: formatDelta(
        (step.repaired?.temperature ?? 0) - (step.injected?.temperature ?? 0),
      ),
    },
    {
      label: "Humidity",
      injected: formatHumidity(step.injected?.humidity),
      repaired: formatHumidity(step.repaired?.humidity),
      delta: formatDelta(
        (step.repaired?.humidity ?? 0) - (step.injected?.humidity ?? 0),
        "%",
      ),
    },
    {
      label: "Pressure",
      injected: formatPressure(step.injected?.pressure),
      repaired: formatPressure(step.repaired?.pressure),
      delta: formatDelta(
        (step.repaired?.pressure ?? 0) - (step.injected?.pressure ?? 0),
        " hPa",
      ),
    },
  ];
  return (
    <Card padding="p-4">
      <h3 className="text-sm font-semibold text-ink">Before and after repair</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="pb-2 pr-3 font-medium">Parameter</th>
            <th className="pb-2 pr-3 font-medium">Injected</th>
            <th className="pb-2 pr-3 font-medium">Repaired</th>
            <th className="pb-2 font-medium">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line last:border-0">
              <td className="py-2 pr-3 text-muted">{row.label}</td>
              <td className="tnum py-2 pr-3 font-medium text-ink">{row.injected}</td>
              <td className="tnum py-2 pr-3 font-medium text-ink">{row.repaired}</td>
              <td className="tnum py-2 text-muted">{row.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {baseline ? (
        <p className="mt-2 text-xs text-muted">
          Baseline at run time: {formatTemp(baseline.temperature)} ·{" "}
          {formatHumidity(baseline.humidity)} · {formatPressure(baseline.pressure)}
        </p>
      ) : null}
    </Card>
  );
}

function StepCard({ step }) {
  return (
    <Card padding="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-ink-soft">
            <FlaskConical className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Step {step.step}
              <span className="ml-2 font-normal text-muted">Simulated</span>
            </h3>
            <p className="tnum mt-0.5 text-[13px] text-muted">
              Injected {formatTemp(step.injected?.temperature)} ·{" "}
              {formatHumidity(step.injected?.humidity)} ·{" "}
              {formatPressure(step.injected?.pressure)}
            </p>
          </div>
        </div>
        <Badge tone={step.has_anomaly ? "alert" : "healthy"}>
          {qcFlagLabel(step.qc_flag)}
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink">{step.flag_reason}</p>

      {step.rule_results?.length ? (
        <div className="mt-4 border-t border-line pt-3">
          <h4 className="text-[13px] font-semibold text-ink">Rule breakdown</h4>
          <ul className="mt-2 flex flex-col gap-1.5">
            {step.rule_results.map((rule) => (
              <li key={rule.rule} className="flex items-start gap-2 text-[13px]">
                {rule.passed ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-healthy-deep" aria-label="Passed" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-coral-deep" aria-label="Failed" />
                )}
                <span className="min-w-0">
                  <span className="font-medium text-ink">{rule.rule}.</span>{" "}
                  <span className="text-muted">{rule.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step.spatial ? (
        <div className="mt-4 border-t border-line pt-3">
          <h4 className="text-[13px] font-semibold text-ink">Spatial evidence</h4>
          {step.spatial.checked ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {step.spatial.reason}
              {typeof step.spatial.neighbour_avg === "number" ? (
                <>
                  {" "}
                  Neighbour average {formatTemp(step.spatial.neighbour_avg)} across{" "}
                  {step.spatial.neighbour_count} neighbours
                  {typeof step.spatial.diff_c === "number"
                    ? `, a difference of ${formatDelta(step.spatial.diff_c)}`
                    : ""}
                  .
                </>
              ) : null}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted">
              Spatial check did not run for this step.
            </p>
          )}
        </div>
      ) : null}

      {step.lstm ? (
        <div className="mt-4 border-t border-line pt-3">
          <h4 className="text-[13px] font-semibold text-ink">LSTM (ONNX)</h4>
          {step.lstm.ran ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Ran and predicted{" "}
              {typeof step.lstm.prediction === "number"
                ? formatTemp(step.lstm.prediction)
                : "no value"}
              .
            </p>
          ) : (
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Did not run — {step.lstm.reason || "no reason given."}
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-4 border-t border-line pt-3">
        <h4 className="text-[13px] font-semibold text-ink">Repair</h4>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {repairMethodLabel(step.repair_method)} →{" "}
          <span className="tnum font-medium text-ink">
            {formatTemp(step.repaired?.temperature)}
          </span>
          {" · "}
          <span className="tnum font-medium text-ink">
            {formatHumidity(step.repaired?.humidity)}
          </span>
          {" · "}
          <span className="tnum font-medium text-ink">
            {formatPressure(step.repaired?.pressure)}
          </span>
        </p>
        {step.evidence ? (
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Heuristic evidence score:{" "}
            <span className="tnum font-semibold text-ink">{step.evidence.score}</span>
            {" — not a model probability. "}
            {evidenceNoteBody(step.evidence.note)}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
