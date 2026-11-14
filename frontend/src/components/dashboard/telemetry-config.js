/**
 * Telemetry chart configuration — parameter and time-range definitions.
 * Kept in a component-free module so TelemetryChart.jsx exports only the
 * component (fast refresh).
 */
export const PARAMETERS = [
  {
    id: "temperature",
    label: "Temperature",
    unit: "°C",
    rawKey: "raw_temperature",
    finalKey: "temperature",
    decimals: 1,
  },
  {
    id: "humidity",
    label: "Humidity",
    unit: "%",
    rawKey: "raw_humidity",
    finalKey: "humidity",
    decimals: 0,
  },
  {
    id: "pressure",
    label: "Pressure",
    unit: "hPa",
    rawKey: "raw_pressure",
    finalKey: "pressure",
    decimals: 1,
  },
];

export const RANGES = [
  { id: "12h", label: "Last 12 hours", ms: 12 * 3600 * 1000 },
  { id: "24h", label: "Last 24 hours", ms: 24 * 3600 * 1000 },
  { id: "7d", label: "Last 7 days", ms: 7 * 24 * 3600 * 1000 },
  { id: "all", label: "All stored", ms: Infinity },
];
