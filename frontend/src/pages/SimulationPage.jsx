import { useState } from "react";
import { FlaskConical, Play, RotateCcw } from "lucide-react";
import Card, { CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Eyebrow from "../components/ui/Eyebrow";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Skeleton from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toast-context";
import ScenarioPicker from "../components/simulation/ScenarioPicker";
import SimulationResults from "../components/simulation/SimulationResults";
import {
  SCENARIOS,
  SIMULATION_PARAMETERS,
  scenarioById,
} from "../components/simulation/scenarios";
import { runSimulation, normalizeApiError } from "../services/api";
import { KNOWN_STATIONS, stationById } from "../utils/stations";

/**
 * Simulation Lab — inject a fault and watch the REAL pipeline judge it.
 *
 * The baseline and the spatial neighbours are live Open-Meteo data, so
 * this page needs the upstream service: while Open-Meteo is unreachable
 * the backend answers 500/502 and the page shows a proper error state
 * with retry — never fake results. Nothing simulated is ever persisted.
 */
const DEFAULT_STEPS = 6;

export default function SimulationPage() {
  const { toast } = useToast();
  const [stationId, setStationId] = useState(KNOWN_STATIONS[0].station_id);
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [parameter, setParameter] = useState("temperature");
  const [value, setValue] = useState("");
  const [steps, setSteps] = useState(DEFAULT_STEPS);
  const [runState, setRunState] = useState({
    status: "idle", // idle | running | ready | error
    result: null,
    error: null,
  });

  const scenario = scenarioById(scenarioId);
  const station = stationById(stationId) || KNOWN_STATIONS[0];

  const parsedValue = value.trim() === "" ? null : Number(value);
  const valueValid =
    scenario.needsValue !== "required" ||
    (parsedValue !== null && Number.isFinite(parsedValue));
  const valueError =
    scenario.needsValue === "required" && !valueValid
      ? "Custom injection needs a number."
      : scenario.needsValue === "optional" &&
          value.trim() !== "" &&
          !Number.isFinite(parsedValue)
        ? "Enter a number, or leave it blank for baseline + 15°C."
        : null;

  const stepsValid =
    Number.isInteger(steps) && steps >= 2 && steps <= 12;

  const canRun =
    runState.status !== "running" && valueValid && stepsValid;

  function buildRequest() {
    const body = {
      station_id: station.station_id,
      latitude: station.latitude,
      longitude: station.longitude,
      scenario: scenario.id,
      parameter,
      // The backend validates steps at 2–12 for every scenario, even the
      // single-step ones; frozen and drift are the only ones that use it.
      steps: scenario.needsSteps ? steps : 2,
    };
    if (parsedValue !== null && Number.isFinite(parsedValue)) {
      body.value = parsedValue;
    }
    return body;
  }

  async function handleRun() {
    if (!canRun) return;
    setRunState({ status: "running", result: null, error: null });
    try {
      const result = await runSimulation(buildRequest());
      setRunState({ status: "ready", result, error: null });
      toast(
        result.summary?.detected
          ? "Fault detected by the pipeline"
          : "Simulation complete — fault not detected",
        {
          tone: result.summary?.detected ? "success" : "info",
          description: result.summary?.message,
        },
      );
    } catch (error) {
      const normalized = normalizeApiError(error);
      setRunState({ status: "error", result: null, error: normalized });
    }
  }

  function handleReset() {
    setScenarioId(SCENARIOS[0].id);
    setParameter("temperature");
    setValue("");
    setSteps(DEFAULT_STEPS);
    setRunState({ status: "idle", result: null, error: null });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="mb-2">Fault injection</Eyebrow>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Simulation Lab
        </h1>
        <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted">
          Real anomalies are rare in live weather data, so this lab injects
          faults on demand and runs them through the same detection and repair
          pipeline as live readings. Every simulated observation is labelled,
          and nothing is written to the live record.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="info">Simulated</Badge>
          <Badge tone="neutral">Not persisted to live records</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Configure a scenario"
            description="Pick a station and a fault. The baseline comes from the live reading at run time."
          />

          <div className="flex flex-col gap-5">
            <div>
              <label
                htmlFor="sim-station"
                className="mb-1.5 block text-sm font-medium text-ink"
              >
                Station
              </label>
              <select
                id="sim-station"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-ink"
              >
                {KNOWN_STATIONS.map((s) => (
                  <option key={s.station_id} value={s.station_id}>
                    {s.name} ({s.station_id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">
                Fault scenario
              </span>
              <ScenarioPicker value={scenarioId} onChange={setScenarioId} />
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                {scenario.description}
              </p>
            </div>

            {scenario.needsParameter ? (
              <div>
                <label
                  htmlFor="sim-parameter"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  Parameter
                </label>
                <select
                  id="sim-parameter"
                  value={parameter}
                  onChange={(e) => setParameter(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-sm font-medium text-ink"
                >
                  {SIMULATION_PARAMETERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scenario.needsValue ? (
              <div>
                <label
                  htmlFor="sim-value"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  {scenario.valueLabel}
                  {scenario.needsValue === "optional" ? (
                    <span className="font-normal text-muted"> (optional)</span>
                  ) : null}
                </label>
                <input
                  id="sim-value"
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={scenario.valuePlaceholder}
                  aria-invalid={Boolean(valueError)}
                  aria-describedby={valueError ? "sim-value-error" : undefined}
                  className="h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink placeholder:text-muted sm:text-sm"
                />
                {valueError ? (
                  <p id="sim-value-error" role="alert" className="mt-1.5 text-[13px] text-coral-deep">
                    {valueError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {scenario.needsSteps ? (
              <div>
                <label
                  htmlFor="sim-steps"
                  className="mb-1.5 block text-sm font-medium text-ink"
                >
                  Steps (2–12)
                </label>
                <input
                  id="sim-steps"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={12}
                  step={1}
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink sm:text-sm"
                />
                <p className="mt-1.5 text-[13px] text-muted">
                  {scenario.id === "drift"
                    ? `Temperature climbs 1.2°C per step, to +${(1.2 * steps).toFixed(1)}°C by step ${steps}.`
                    : `The same baseline reading repeats ${steps} times.`}
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border border-line bg-mist p-3">
              <h3 className="text-[13px] font-semibold text-ink">Preview</h3>
              <dl className="mt-2 flex flex-col gap-1 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Station</dt>
                  <dd className="font-medium text-ink">{station.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Scenario</dt>
                  <dd className="font-medium text-ink">{scenario.name}</dd>
                </div>
                {scenario.needsParameter ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Parameter</dt>
                    <dd className="font-medium text-ink">{parameter}</dd>
                  </div>
                ) : null}
                {parsedValue !== null && Number.isFinite(parsedValue) ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Injected value</dt>
                    <dd className="tnum font-medium text-ink">{parsedValue}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Steps</dt>
                  <dd className="tnum font-medium text-ink">
                    {scenario.needsSteps ? steps : "1 (single step)"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleRun}
                disabled={!canRun}
                className="flex-1"
                size="lg"
              >
                <Play className="h-4 w-4" aria-hidden />
                {runState.status === "running" ? "Running…" : "Run simulation"}
              </Button>
              <Button variant="secondary" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        <div className="min-w-0 lg:col-span-3">
          {runState.status === "idle" ? (
            <Card className="flex h-full flex-col justify-center">
              <EmptyState
                icon={FlaskConical}
                title="No simulation run yet"
                description="Configure a scenario on the left and run it. The pipeline judges the injected fault exactly as it would a live reading — rules, spatial check, LSTM, repair — and the full trace appears here."
              />
            </Card>
          ) : runState.status === "running" ? (
            <Card>
              <div className="flex flex-col gap-3 py-4" aria-live="polite">
                <p className="text-sm font-medium text-ink">
                  Running {scenario.name} through the real pipeline…
                </p>
                <p className="text-[13px] leading-relaxed text-muted">
                  Fetching the live baseline and neighbour readings first —
                  this can take a few seconds.
                </p>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            </Card>
          ) : runState.status === "error" ? (
            <Card>
              <ErrorState
                title="Simulation unavailable"
                message={errorMessageFor(runState.error)}
                onRetry={handleRun}
                retryLabel="Run again"
              />
            </Card>
          ) : (
            <SimulationResults result={runState.result} />
          )}
        </div>
      </div>
    </div>
  );
}

/** User-facing wording for a failed simulation run. */
function errorMessageFor(error) {
  if (!error) return "The simulation could not run.";
  if (error.kind === "upstream" || error.kind === "server") {
    return (
      "The simulation needs live weather data for its baseline and " +
      "neighbours, and the upstream service (Open-Meteo) is unreachable or " +
      "rate-limited right now. Nothing was simulated and nothing was " +
      "stored. Try again later, or from a network with quota."
    );
  }
  if (error.kind === "validation") {
    return `The backend rejected the request: ${error.message}`;
  }
  return error.message;
}
