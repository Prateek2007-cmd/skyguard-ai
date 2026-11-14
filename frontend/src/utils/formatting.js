/**
 * Number formatting for telemetry values. All readings are °C, hPa and %RH.
 * Use `formatTemp` etc. everywhere so units and precision stay consistent.
 */

const num1 = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const num0 = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/** 28.4 → "28.4°C"; null/undefined → "—" */
export function formatTemp(value) {
  return isFiniteNumber(value) ? `${num1.format(value)}°C` : "—";
}

/** 1012.1 → "1,012.1 hPa" */
export function formatPressure(value) {
  return isFiniteNumber(value) ? `${num1.format(value)} hPa` : "—";
}

/** 61 → "61%" */
export function formatHumidity(value) {
  return isFiniteNumber(value) ? `${num0.format(value)}%` : "—";
}

/** 0.885 → "88.5%" (for 0–1 metric values) */
export function formatPercent01(value, digits = 1) {
  if (!isFiniteNumber(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

/** 42.0 → "42 min"; 150 → "2 h 30 min" */
export function formatGapMinutes(value) {
  if (!isFiniteNumber(value)) return "—";
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  return mins ? `${hours} h ${mins} min` : `${hours} h`;
}

/** Signed delta, e.g. +1.2°C / −0.8°C */
export function formatDelta(value, unit = "°C") {
  if (!isFiniteNumber(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${num1.format(Math.abs(value))}${unit}`;
}

/** Human label for a repair method code. */
export function repairMethodLabel(method) {
  switch (method) {
    case "NONE":
      return "No repair needed";
    case "SPATIAL_KNN_WEIGHTED_AVERAGE":
      return "Spatial KNN weighted average";
    case "LSTM_ONNX_INFERENCE":
      return "LSTM (ONNX) inference";
    case "PHYSICAL_LIMIT_CLAMP":
      return "Physical limit clamp";
    default:
      return method || "—";
  }
}

/** Human label for a qc_flag. */
export function qcFlagLabel(flag) {
  switch (flag) {
    case "GOOD":
      return "Good";
    case "SUSPECT":
      return "Suspect";
    case "FAULTY":
      return "Faulty";
    default:
      return flag || "—";
  }
}

/**
 * The evidence `note` from the API opens with the same disclaimer the UI
 * already renders next to the score ("Heuristic evidence score, not a
 * model probability."). Strip that leading sentence so the two don't
 * repeat each other; return the note unchanged when it doesn't open
 * with the disclaimer (never silently drop unknown text).
 */
const EVIDENCE_DISCLAIMER =
  /^Heuristic evidence score, not a model probability\.\s*/;
export function evidenceNoteBody(note) {
  if (!note) return "";
  return String(note).replace(EVIDENCE_DISCLAIMER, "");
}
