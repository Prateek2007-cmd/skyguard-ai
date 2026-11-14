import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import Card, { CardHeader } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Eyebrow from "../components/ui/Eyebrow";
import MetricCard from "../components/ui/MetricCard";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Skeleton from "../components/ui/Skeleton";
import { getEvaluation, normalizeApiError } from "../services/api";
import { formatPercent01, formatTemp } from "../utils/formatting";

const FAULT_LABELS = {
  spike: "Spike",
  range: "Range violation",
  frozen: "Frozen sensor",
  spatial: "Spatial inconsistency",
  drift: "Drift",
};

/**
 * Model Performance — precision/recall/F1, confusion matrix, per-fault
 * recall, per-method comparison, false positives/negatives — all fetched
 * LIVE from GET /evaluation, never hardcoded. The dataset is labelled
 * SYNTHETIC everywhere it appears, with the backend's limitations shown.
 */
export default function EvaluationPage() {
  const [seed, setSeed] = useState(42);
  const [nCases, setNCases] = useState(240);
  const [applied, setApplied] = useState({ seed: 42, nCases: 240 });
  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    // Data-fetching effect: re-running the evaluation for the applied seed/cases.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, status: "loading", error: null }));
    getEvaluation({ seed: applied.seed, nCases: applied.nCases })
      .then((data) => {
        if (!active) return;
        setState({ status: "ready", data, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState((s) => ({
          ...s,
          status: "error",
          error: normalizeApiError(error),
        }));
      });
    return () => {
      active = false;
    };
  }, [applied]);

  const dirty = seed !== applied.seed || nCases !== applied.nCases;
  const seedValid = Number.isInteger(seed);
  const nValid = Number.isInteger(nCases) && nCases >= 50 && nCases <= 1000;

  const data = state.data;
  const metrics = data?.metrics;
  const confusion = data?.confusion;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-2">Synthetic benchmark</Eyebrow>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Model Performance
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
          How well the checkers catch faults — measured live against a seeded
          labelled set. Every number below is computed by the backend on
          request, never written into this page.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="info">Synthetic dataset</Badge>
          <Badge tone="neutral">Seed {applied.seed} · {applied.nCases} cases</Badge>
        </div>
      </div>

      <Card padding="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="eval-seed" className="mb-1.5 block text-sm font-medium text-ink">
              Seed
            </label>
            <input
              id="eval-seed"
              type="number"
              inputMode="numeric"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="h-10 w-28 rounded-lg border border-line-strong bg-white px-3 text-base text-ink sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="eval-n" className="mb-1.5 block text-sm font-medium text-ink">
              Cases (50–1000)
            </label>
            <input
              id="eval-n"
              type="number"
              inputMode="numeric"
              min={50}
              max={1000}
              value={nCases}
              onChange={(e) => setNCases(Number(e.target.value))}
              className="h-10 w-28 rounded-lg border border-line-strong bg-white px-3 text-base text-ink sm:text-sm"
            />
          </div>
          <Button
            disabled={!dirty || !seedValid || !nValid}
            onClick={() => setApplied({ seed, nCases })}
          >
            Re-run evaluation
          </Button>
          <p className="pb-2 text-[13px] text-muted">
            A different seed regenerates the labelled set; scores will move.
          </p>
        </div>
      </Card>

      {state.status === "loading" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state.status === "error" ? (
        <Card>
          <ErrorState
            title="Could not load the evaluation"
            message={state.error?.message}
            onRetry={() => setApplied({ ...applied })}
          />
        </Card>
      ) : !data ? (
        <Card>
          <EmptyState
            icon={FlaskConical}
            title="No evaluation data"
            description="The backend returned no evaluation. Try re-running it."
          />
        </Card>
      ) : (
        <>
          <section
            aria-label="Headline metrics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <MetricCard
              label="Precision"
              value={formatPercent01(metrics?.precision)}
              sub="Of flagged readings, how many were real faults."
            />
            <MetricCard
              label="Recall"
              value={formatPercent01(metrics?.recall)}
              sub="Of real faults, how many were caught."
            />
            <MetricCard
              label="F1 score"
              value={formatPercent01(metrics?.f1)}
              sub="Harmonic mean of precision and recall."
              tone="accent"
            />
            <MetricCard
              label="False alarm rate"
              value={formatPercent01(metrics?.false_alarm_rate)}
              sub={`Accuracy ${formatPercent01(metrics?.accuracy)} across ${data.dataset?.total_cases} cases.`}
              tone={
                metrics?.false_alarm_rate > 0.05 ? "alert" : "healthy"
              }
            />
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Confusion matrix"
                description="Counts of correct and missed calls on the synthetic set."
              />
              {confusion ? (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <ConfusionCell label="True positives" value={confusion.tp} note="Faults caught" tone="healthy" />
                  <ConfusionCell label="False positives" value={confusion.fp} note="Clean readings flagged" tone="alert" />
                  <ConfusionCell label="False negatives" value={confusion.fn} note="Faults missed" tone="alert" />
                  <ConfusionCell label="True negatives" value={confusion.tn} note="Clean readings passed" tone="healthy" />
                </div>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title="Recall by fault type"
                description="Which faults the pipeline catches — and the one it does not."
              />
              <div className="flex flex-col gap-3">
                {Object.entries(data.per_fault_recall || {}).map(
                  ([fault, recall]) => (
                    <div key={fault}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-ink">
                          {FAULT_LABELS[fault] || fault}
                        </span>
                        <span className="tnum font-semibold text-ink">
                          {formatPercent01(recall)}
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist"
                        role="img"
                        aria-label={`${FAULT_LABELS[fault] || fault} recall ${formatPercent01(recall)}`}
                      >
                        <div
                          className={`h-full rounded-full ${recall < 0.5 ? "bg-coral" : "bg-healthy"}`}
                          style={{ width: `${Math.round(recall * 100)}%` }}
                        />
                      </div>
                    </div>
                  ),
                )}
              </div>
              {(data.per_fault_recall?.drift ?? 1) < 0.5 ? (
                <p className="mt-4 rounded-lg bg-coral-wash px-3 py-2 text-[13px] leading-relaxed text-ink">
                  Drift recall is the known gap: the live pipeline has no
                  drift detector yet, so slow climbs pass every check. See
                  the limitations below.
                </p>
              ) : null}
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Rules alone vs rules + spatial check"
                description="The spatial KNN check is what catches faults the range rules miss."
              />
              <MethodTable perMethod={data.per_method} />
            </Card>

            <Card>
              <CardHeader
                title="Freshness check"
                description="Dropout detection, scored separately from value faults."
              />
              {data.freshness ? (
                <>
                  <p className="tnum text-[28px] font-semibold leading-none tracking-tight text-ink">
                    {formatPercent01(data.freshness.accuracy)}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {data.freshness.correct} of {data.freshness.cases} freshness
                    cases judged correctly.
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">
                    Method: {data.freshness.method}
                  </p>
                </>
              ) : null}
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={`False positives (${data.false_positives?.length ?? 0})`}
                description="Clean readings the pipeline flagged. Each one is a false alarm a forecaster would have to chase."
              />
              {data.false_positives?.length ? (
                <ul className="flex flex-col gap-2">
                  {data.false_positives.map((fp) => (
                    <li key={fp.case_id} className="rounded-lg bg-mist px-3 py-2.5 text-sm">
                      <span className="font-mono text-xs text-muted">
                        Case {fp.case_id}
                      </span>
                      <span className="tnum ml-2 font-medium text-ink">
                        {formatTemp(fp.temperature)}
                      </span>
                      <p className="mt-0.5 text-[13px] leading-snug text-muted">
                        {fp.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed text-muted">
                  None — no clean reading was flagged in this run.
                </p>
              )}
            </Card>

            <Card>
              <CardHeader
                title={`False negatives (${data.false_negatives?.length ?? 0})`}
                description="Real faults the pipeline missed. These are the misses that matter most."
              />
              {data.false_negatives?.length ? (
                <ul className="flex flex-col gap-2">
                  {data.false_negatives.map((fn) => (
                    <li key={fn.case_id} className="rounded-lg bg-mist px-3 py-2.5 text-sm">
                      <span className="font-mono text-xs text-muted">
                        Case {fn.case_id}
                      </span>
                      <span className="ml-2 font-medium text-ink">
                        {FAULT_LABELS[fn.fault] || fn.fault}
                      </span>
                      <span className="tnum ml-2 text-muted">
                        {formatTemp(fn.temperature)}
                      </span>
                      <p className="mt-0.5 text-[13px] leading-snug text-muted">
                        {fn.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-relaxed text-muted">
                  None — every injected fault was caught in this run.
                </p>
              )}
            </Card>
          </section>

          <Card>
            <CardHeader
              title="Dataset and limitations"
              description="What these scores do — and do not — measure."
            />
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">Synthetic dataset</Badge>
              <Badge tone="neutral">
                Seed {data.dataset?.seed} · {data.dataset?.total_cases} cases
              </Badge>
            </div>
            {data.dataset?.composition ? (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                {Object.entries(data.dataset.composition).map(([key, count]) => (
                  <div key={key} className="rounded-lg bg-mist px-2 py-2.5">
                    <p className="tnum text-lg font-semibold leading-none text-ink">
                      {count}
                    </p>
                    <p className="mt-1 text-xs leading-tight text-muted">
                      {key === "normal" ? "Normal" : FAULT_LABELS[key] || key}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {data.dataset?.generated_by ? (
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {data.dataset.generated_by}
              </p>
            ) : null}
            {data.limitations?.length ? (
              <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                {data.limitations.map((limitation) => (
                  <li key={limitation} className="flex gap-2 text-sm leading-relaxed text-muted">
                    <span aria-hidden className="text-ink">—</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </>
      )}
    </div>
  );
}

function ConfusionCell({ label, value, note, tone }) {
  return (
    <div
      className={`rounded-xl border px-3 py-4 ${
        tone === "alert" ? "border-coral/30 bg-coral-wash" : "border-line bg-mist"
      }`}
    >
      <p className="tnum text-[26px] font-semibold leading-none tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-1.5 text-[13px] font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </div>
  );
}

function MethodTable({ perMethod }) {
  if (!perMethod) return null;
  const rows = [
    ["rule_only", "Rules only"],
    ["rule_plus_spatial", "Rules + spatial check"],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-muted">
          <th className="pb-2 pr-3 font-medium">Method</th>
          <th className="pb-2 pr-2 font-medium">Precision</th>
          <th className="pb-2 pr-2 font-medium">Recall</th>
          <th className="pb-2 font-medium">F1</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([key, label]) => {
          const m = perMethod[key];
          if (!m) return null;
          return (
            <tr key={key} className="border-b border-line last:border-0">
              <td className="py-2.5 pr-3 font-medium text-ink">{label}</td>
              <td className="tnum py-2.5 pr-2 text-muted">{formatPercent01(m.precision)}</td>
              <td className="tnum py-2.5 pr-2 text-muted">{formatPercent01(m.recall)}</td>
              <td className="tnum py-2.5 font-semibold text-ink">{formatPercent01(m.f1)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
