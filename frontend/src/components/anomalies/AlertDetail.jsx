import { Check, X } from "lucide-react";
import Badge from "../ui/Badge";
import Card from "../ui/Card";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Skeleton, { SkeletonText } from "../ui/Skeleton";
import { TriangleAlert } from "lucide-react";
import { stationDisplayName } from "../../utils/stations";
import { formatDateTime } from "../../utils/time";
import {
  evidenceNoteBody,
  formatDelta,
  formatHumidity,
  formatPressure,
  formatTemp,
  qcFlagLabel,
  repairMethodLabel,
} from "../../utils/formatting";

const severityTone = { high: "alert", medium: "info", low: "neutral" };

/**
 * AlertDetail — the full story of one flagged reading: what was detected,
 * why it was suspicious, which methods caught it, the rule breakdown,
 * before/after values, and how it was repaired. The evidence score is
 * always labelled "Heuristic evidence score — not a model probability".
 */
export default function AlertDetail({ detail, status, error, onRetry }) {
  if (status === "loading") {
    return (
      <Card>
        <Skeleton className="h-6 w-2/3" />
        <div className="mt-4">
          <SkeletonText lines={5} />
        </div>
        <Skeleton className="mt-6 h-32 w-full" />
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <ErrorState
          title="Could not load this alert"
          message={error?.message}
          onRetry={onRetry}
        />
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card className="flex h-full flex-col justify-center">
        <EmptyState
          icon={TriangleAlert}
          title="Select an alert"
          description="Choose a flagged reading from the list to see what was detected, why it looked suspicious, and how it was repaired."
        />
      </Card>
    );
  }

  const raw = detail.before_after?.raw;
  const repaired = detail.before_after?.repaired;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {stationDisplayName(detail.station_id)}
          </h2>
          <p className="tnum mt-0.5 font-mono text-xs text-muted">
            {detail.station_id} · observed{" "}
            {formatDateTime(detail.observed_at || detail.timestamp)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={severityTone[detail.severity] || "neutral"}>
            {detail.severity} severity
          </Badge>
          <Badge tone={detail.qc_flag === "FAULTY" ? "alert" : "info"}>
            {qcFlagLabel(detail.qc_flag)}
          </Badge>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-ink">What was detected</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          {detail.flag_reason}
        </p>
        {detail.root_cause ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">
              {detail.root_cause.label}.
            </span>{" "}
            {detail.root_cause.explanation}
          </p>
        ) : null}
      </div>

      {detail.detection_methods?.length ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Detection methods</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {detail.detection_methods.map((method) => (
              <Badge key={method} tone="info">
                {method}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {detail.evidence ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Evidence</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Heuristic evidence score:{" "}
            <span className="tnum font-semibold text-ink">
              {detail.evidence.score}
            </span>{" "}
            — not a model probability.{" "}
            {evidenceNoteBody(detail.evidence.note)}
          </p>
          {detail.evidence.signals?.length ? (
            <p className="mt-1 text-[13px] text-muted">
              Signals: {detail.evidence.signals.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {detail.rule_results?.length ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Rule breakdown</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {detail.rule_results.map((rule) => (
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

      {raw && repaired ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Before and after repair</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="pb-2 pr-3 font-medium">Parameter</th>
                <th className="pb-2 pr-3 font-medium">Raw</th>
                <th className="pb-2 pr-3 font-medium">Repaired</th>
                <th className="pb-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              <BeforeAfterRow
                label="Temperature"
                raw={formatTemp(raw.temperature)}
                repaired={formatTemp(repaired.temperature)}
                delta={formatDelta(repaired.temperature - raw.temperature)}
              />
              <BeforeAfterRow
                label="Humidity"
                raw={formatHumidity(raw.humidity)}
                repaired={formatHumidity(repaired.humidity)}
                delta={formatDelta(repaired.humidity - raw.humidity, "%")}
              />
              <BeforeAfterRow
                label="Pressure"
                raw={formatPressure(raw.pressure)}
                repaired={formatPressure(repaired.pressure)}
                delta={formatDelta(repaired.pressure - raw.pressure, " hPa")}
              />
            </tbody>
          </table>
          </div>
        </div>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">Repair</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          <span className="font-medium text-ink">
            {repairMethodLabel(detail.repair_method)}.
          </span>{" "}
          {detail.repair_explanation || ""}
        </p>
      </div>
    </Card>
  );
}

function BeforeAfterRow({ label, raw, repaired, delta }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-3 text-muted">{label}</td>
      <td className="tnum py-2 pr-3 font-medium text-ink">{raw}</td>
      <td className="tnum py-2 pr-3 font-medium text-ink">{repaired}</td>
      <td className="tnum py-2 text-muted">{delta}</td>
    </tr>
  );
}
