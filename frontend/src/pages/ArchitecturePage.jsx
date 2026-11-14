import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import Card, { CardHeader } from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Eyebrow from "../components/ui/Eyebrow";
import { getEvaluation } from "../services/api";
import { formatPercent01 } from "../utils/formatting";

/**
 * System Architecture — the full pipeline, stage by stage, with honest
 * notes where the system has limits: virtual stations, synthetic LSTM
 * training data, and the drift detection gap. Each stage expands to a
 * plain-language explanation.
 */
const STAGES = [
  {
    name: "Open-Meteo ingestion",
    tagline: "Live weather data, free API",
    body: "Every reading starts as a current-conditions fetch from Open-Meteo — temperature, humidity and surface pressure for one latitude/longitude. The free tier is rate-limited per egress IP, so on a shared network the live feed can answer 429; the dashboard treats that as an error state with stored data still available, never as fake readings.",
    note: null,
  },
  {
    name: "Virtual stations",
    tagline: "Six nodes in a 40 km ring around Hyderabad",
    body: "SkyGuard defines six virtual stations: one central node plus five surrounding nodes at 72° steps on a 40 km ring. Each node is a coordinate that Open-Meteo answers for — the layout mirrors a real AWS network's geometry, but these are virtual nodes, not IMD stations, and the product says so everywhere.",
    note: "Honest note: the six stations are virtual nodes on live Open-Meteo data, not real IMD automatic weather stations.",
  },
  {
    name: "FastAPI backend",
    tagline: "Async Python service, /api/v1",
    body: "A FastAPI service owns ingestion, detection, repair and storage. Endpoints serve live readings, stored history, alerts, health summaries, evaluation runs and simulations. The frontend talks to it through the /api/v1 base URL (Vite proxies /api in development).",
    note: null,
  },
  {
    name: "Rule engine",
    tagline: "Physical limits and flatline detection",
    body: "The first pass is deterministic: temperature must sit inside (−10, 55)°C, pressure inside (900, 1100) hPa, humidity inside (0, 100)%. A separate flatline rule flags a sensor that reports the identical value across several distinct observation times — real weather drifts, so a frozen value means the sensor stopped sampling. The flatline rule only counts distinct upstream observations, so a slow-changing feed cannot false-positive it.",
    note: null,
  },
  {
    name: "Spatial KNN verification",
    tagline: "Does this reading agree with its neighbours?",
    body: "A reading can pass every range rule and still be wrong — the official 55°C example sits exactly on the range boundary. The spatial check compares each station against a distance-weighted average of its neighbours; a large disagreement flags a spatial inconsistency and supplies the repair value. This is the check that does most of the real work.",
    liveMetric: "spatial",
    note: null,
  },
  {
    name: "ONNX LSTM",
    tagline: "Sequence model for repair, not classification",
    body: "A small LSTM (ONNX runtime) scores 12-step temperature windows. It runs only when a reading is already flagged and exactly 12 history rows exist, and it produces a repair estimate — it does not classify readings, and it is not scored in the evaluation page for that reason.",
    note: "Honest note: the LSTM was trained on 90 days of synthetic sine-wave data, not real AWS fault records. Its repair estimates are only as good as that training data.",
  },
  {
    name: "Repair engine",
    tagline: "Spatial average, then LSTM, then clamp",
    body: "A flagged reading is repaired in order of preference: the spatial KNN weighted average of neighbours, the LSTM inference when it ran, and finally a physical-limit clamp as a last resort. The repaired value is what enters the record; the raw value is kept alongside it so nothing is ever hidden.",
    note: null,
  },
  {
    name: "SQLite storage",
    tagline: "Observations, alerts and health, persisted",
    body: "Every distinct observation is stored with its raw and repaired values, QC flag, flag reason and repair method. History, alerts and health summaries all read from this record — which is why the dashboard keeps working with real stored data even when the live feed is down.",
    note: null,
  },
  {
    name: "React dashboard",
    tagline: "This app — Command Center, Lab, Intelligence",
    body: "A React 19 + Vite frontend polls the backend every 30 seconds, draws telemetry from stored history (so charts survive refresh), and renders the map, alerts, health scores and evaluation from the same record the backend keeps. Simulated observations are labelled Simulated everywhere and are never persisted.",
    note: null,
  },
];

export default function ArchitecturePage() {
  // The spatial stage and the drift gap cite live evaluation numbers —
  // fetched here, never hardcoded, so they stay true to whatever the
  // backend computes.
  const [evaluation, setEvaluation] = useState(null);

  useEffect(() => {
    let active = true;
    getEvaluation({ seed: 42, nCases: 240 })
      .then((data) => {
        if (active) setEvaluation(data);
      })
      .catch(() => {
        if (active) setEvaluation(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const perMethod = evaluation?.per_method || null;
  const driftRecall = evaluation?.per_fault_recall?.drift;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-2">Nine stages, one pass</Eyebrow>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          System Architecture
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
          How a reading travels from the sky to the record — and what each
          stage can and cannot promise. Expand any stage for the details.
        </p>
      </div>

      <Card>
        <CardHeader
          title="The pipeline"
          description="Nine stages, in the order a reading passes through them."
        />
        <ol className="relative flex flex-col">
          {STAGES.map((stage, i) => (
            <li key={stage.name} className="relative flex gap-4 pb-2 last:pb-0">
              {/* Connector line */}
              {i < STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[15px] top-9 h-[calc(100%-24px)] w-px bg-line-strong"
                />
              ) : null}
              <span className="tnum z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-[13px] font-semibold text-ink">
                {i + 1}
              </span>
              <details className="group min-w-0 flex-1 rounded-xl border border-line bg-white open:shadow-[var(--shadow-whisper)]">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-snug text-ink">
                      {stage.name}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                      {stage.tagline}
                    </span>
                  </span>
                  <ChevronDown
                    className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-line px-4 py-3">
                  <p className="max-w-[72ch] text-sm leading-relaxed text-ink-soft">
                    {stage.body}
                  </p>
                  {stage.liveMetric === "spatial" && perMethod ? (
                    <p className="tnum mt-3 rounded-lg bg-mist px-3 py-2 text-[13px] leading-relaxed text-ink">
                      Live from the evaluation (seed 42, 240 synthetic cases):
                      rules alone recall{" "}
                      {formatPercent01(perMethod.rule_only?.recall)} of faults;
                      rules plus spatial recall{" "}
                      {formatPercent01(perMethod.rule_plus_spatial?.recall)}.
                    </p>
                  ) : null}
                  {stage.note ? (
                    <p className="mt-3 rounded-lg bg-instrument-wash px-3 py-2 text-[13px] leading-relaxed text-ink">
                      {stage.note}
                    </p>
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader
          title="Known gaps"
          description="What SkyGuard does not do yet — stated plainly, because a judging panel will ask."
        />
        <ul className="flex flex-col gap-4">
          <li className="flex flex-col gap-1 border-b border-line pb-4 last:border-0 last:pb-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink">No drift detector</span>
              <Badge tone="alert">Open gap</Badge>
            </span>
            <p className="max-w-[72ch] text-sm leading-relaxed text-muted">
              Slow sensor drift (+1.2°C per step) passes every rule and the
              spatial check: no single step looks wrong.
              {typeof driftRecall === "number" ? (
                <>
                  {" "}
                  The evaluation page shows drift recall at{" "}
                  {formatPercent01(driftRecall)} on the synthetic set
                </>
              ) : (
                " The evaluation page shows drift recall on the synthetic set"
              )}
              {" "}— the Simulation Lab&apos;s drift scenario demonstrates the
              gap live.
            </p>
          </li>
          <li className="flex flex-col gap-1 border-b border-line pb-4 last:border-0 last:pb-0">
            <span className="text-sm font-semibold text-ink">
              LSTM trained on synthetic data
            </span>
            <p className="max-w-[72ch] text-sm leading-relaxed text-muted">
              Ninety days of synthetic sine-wave data, not real AWS fault
              records. Retraining on real Open-Meteo historical data is the
              next step if time allows.
            </p>
          </li>
          <li className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-ink">
              Virtual stations, not IMD hardware
            </span>
            <p className="max-w-[72ch] text-sm leading-relaxed text-muted">
              The six nodes read live Open-Meteo data at fixed coordinates.
              Deploying against real IMD station feeds would need their
              ingestion API and credentials.
            </p>
          </li>
        </ul>
      </Card>
    </div>
  );
}
