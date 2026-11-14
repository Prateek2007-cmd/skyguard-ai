/**
 * Shared shape documentation for the SkyGuard API (see docs/api-contract.md).
 * Plain-JS project: these are JSDoc typedefs, imported by services/api.js
 * and the pages that consume the responses.
 */

/**
 * @typedef {Object} StationReading
 * @property {string} station_id
 * @property {string} [name]
 * @property {number} [latitude]
 * @property {number} [longitude]
 * @property {number} temperature - repaired (final) value, °C
 * @property {number} pressure - repaired (final) value, hPa
 * @property {number} humidity - repaired (final) value, %RH
 * @property {number} raw_temperature
 * @property {number} [raw_pressure]
 * @property {number} [raw_humidity]
 * @property {number} [repaired_temperature]
 * @property {boolean} has_anomaly
 * @property {string} qc_flag - GOOD | SUSPECT | FAULTY
 * @property {string} flag_reason
 * @property {string} repair_method - NONE | SPATIAL_KNN_WEIGHTED_AVERAGE |
 *   LSTM_ONNX_INFERENCE | PHYSICAL_LIMIT_CLAMP
 * @property {string} [observed_at] - upstream observation time (ISO)
 * @property {string} [fetched_at] - when SkyGuard fetched it (ISO)
 * @property {boolean} [is_duplicate]
 * @property {string} [timestamp]
 * @property {string} [id] - present on stored observations
 */

/**
 * @typedef {Object} Alert
 * @property {string} id
 * @property {string} station_id
 * @property {string} timestamp
 * @property {string} observed_at
 * @property {number} temperature
 * @property {number} pressure
 * @property {number} humidity
 * @property {number} raw_temperature
 * @property {number} raw_pressure
 * @property {number} raw_humidity
 * @property {number} repaired_temperature
 * @property {string} repair_method
 * @property {string} qc_flag
 * @property {string} flag_reason
 * @property {boolean} has_anomaly
 * @property {string} severity - low | medium | high
 * @property {{category: string, label: string, explanation: string}} root_cause
 * @property {{score: number, method: string, signals: string[], note: string}} evidence
 *   Heuristic evidence score — never a model probability.
 */

/**
 * @typedef {Object} AlertDetail
 * @property {Alert} alert - base alert fields (spread at top level)
 * @property {{rule: string, passed: boolean, detail: string}[]} rule_results
 * @property {string[]} detection_methods
 * @property {{raw: {temperature: number, pressure: number, humidity: number},
 *   repaired: {temperature: number, pressure: number, humidity: number}}} before_after
 * @property {string} repair_explanation
 */

/**
 * @typedef {Object} HealthSummaryStation
 * @property {string} station_id
 * @property {number} readings
 * @property {number} anomalies
 * @property {number} anomaly_rate
 * @property {string} last_observed_at
 * @property {string} last_ingested_at
 * @property {{is_stale: boolean, gap_minutes: number, reason: string}} freshness
 * @property {number} longest_repeated_run
 * @property {{temperature: number, pressure: number, humidity: number, spatial: number}} per_parameter_anomalies
 * @property {number} health_score
 * @property {string} maintenance_priority - low | medium | high
 */

/**
 * @typedef {Object} SimulationStep
 * @property {number} step
 * @property {boolean} simulated
 * @property {{temperature: number, pressure: number, humidity: number}} injected
 * @property {string} qc_flag
 * @property {string} flag_reason
 * @property {boolean} has_anomaly
 * @property {{rule: string, passed: boolean, detail: string}[]} rule_results
 * @property {{checked: boolean, anomaly: boolean, reason: string,
 *   neighbour_avg: number, neighbour_count: number, diff_c: number}} spatial
 * @property {{available: boolean, ran: boolean, reason: string,
 *   prediction: number|null}} lstm
 * @property {{temperature: number, pressure: number, humidity: number}} repaired
 * @property {string} repair_method
 * @property {{score: number, method: string, signals: string[], note: string}} evidence
 */

/**
 * @typedef {Object} SimulationResult
 * @property {boolean} simulated
 * @property {boolean} persisted
 * @property {string} station_id
 * @property {string} scenario
 * @property {{temperature: number, pressure: number, humidity: number,
 *   observed_at: string}} baseline
 * @property {SimulationStep[]} [steps]
 * @property {{is_stale: boolean, gap_minutes: number, reason: string,
 *   explanation: string}} [gap_analysis] - dropout scenario only
 * @property {{detected: boolean, steps_flagged: number, steps_total: number,
 *   message: string}} [summary]
 */

export {};
