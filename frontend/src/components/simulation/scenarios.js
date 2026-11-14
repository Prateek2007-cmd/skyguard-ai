import {
  ArrowDownToLine,
  ArrowUpRight,
  Flame,
  Gauge,
  Snowflake,
  ThermometerSun,
} from "lucide-react";

/**
 * Simulation scenarios (POST /simulate). Notes on backend behaviour, read
 * from the endpoint (backend/app/api/extended.py):
 * - `steps` validates at 2–12 for every scenario, but spike / official55 /
 *   custom always run exactly one injected step; only frozen and drift use
 *   the step count. The form sends 2 for single-step scenarios.
 * - spike injects into temperature only (value or baseline + 15°C);
 *   `parameter` is ignored except by custom.
 * - drift adds +1.2°C per step; frozen repeats the baseline reading.
 * - dropout has no injected steps — it returns a freshness gap analysis.
 * - official55 is the PS 73 worked example: 55°C sits exactly on the range
 *   boundary, so the range rule passes and only the spatial check can
 *   catch it. That is the point of the example.
 */
export const SCENARIOS = [
  {
    id: "spike",
    name: "Temperature spike",
    tagline: "One reading jumps far from the baseline",
    description:
      "Injects a single temperature spike — your value, or the live baseline plus 15°C. Tests the range rule and the spatial check.",
    icon: ThermometerSun,
    needsValue: "optional",
    valueLabel: "Spike temperature (°C)",
    valuePlaceholder: "Baseline + 15°C",
    needsSteps: false,
    needsParameter: false,
  },
  {
    id: "frozen",
    name: "Frozen sensor",
    tagline: "The same reading, step after step",
    description:
      "Repeats the live baseline reading for every step. A real sensor drifts; identical values across distinct observations trip the flatline rule.",
    icon: Snowflake,
    needsValue: false,
    needsSteps: true,
    needsParameter: false,
  },
  {
    id: "drift",
    name: "Sensor drift",
    tagline: "A slow climb, +1.2°C per step",
    description:
      "Temperature climbs 1.2°C every step. Drift is the hardest fault to catch — no single step looks wrong, and the current pipeline has no dedicated drift detector.",
    icon: ArrowUpRight,
    needsValue: false,
    needsSteps: true,
    needsParameter: false,
  },
  {
    id: "dropout",
    name: "Dropout",
    tagline: "The station stops reporting",
    description:
      "No injected readings — a dropout is the absence of a reading. SkyGuard answers with a freshness gap analysis for the station.",
    icon: ArrowDownToLine,
    needsValue: false,
    needsSteps: false,
    needsParameter: false,
  },
  {
    id: "official55",
    name: "Official 55°C example",
    tagline: "The PS 73 worked example, verbatim",
    description:
      "55°C with 95% humidity and 985 hPa while neighbours stay normal. 55°C sits exactly on the range boundary, so only the spatial check can catch it.",
    icon: Flame,
    needsValue: false,
    needsSteps: false,
    needsParameter: false,
  },
  {
    id: "custom",
    name: "Custom injection",
    tagline: "Pick a parameter and a value",
    description:
      "Inject one reading of your choice into temperature, pressure or humidity. Out-of-range values are fair game — testing the range rule is the point.",
    icon: Gauge,
    needsValue: "required",
    valueLabel: "Injected value",
    valuePlaceholder: "e.g. 47",
    needsSteps: false,
    needsParameter: true,
  },
];

export const SIMULATION_PARAMETERS = [
  { id: "temperature", label: "Temperature (°C)" },
  { id: "pressure", label: "Pressure (hPa)" },
  { id: "humidity", label: "Humidity (%RH)" },
];

export function scenarioById(id) {
  return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
}
