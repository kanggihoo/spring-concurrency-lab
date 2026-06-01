import { loadConfig } from "./lib/config.js";
import { captureConsistency, resetIfNeeded } from "./lib/consistency.js";
import { createReservationMetrics, initializeMetrics } from "./lib/metrics.js";
import { runReservationScenario } from "./lib/reservation-scenario.js";
import { createExpectedStatusCallback } from "./lib/response-classifier.js";
import { buildOptions } from "./lib/scenarios.js";

const config = loadConfig();
const metrics = createReservationMetrics();
const reservationResponseCallback = createExpectedStatusCallback(config.expectedStatuses);

export const options = buildOptions(config);

export function setup() {
  initializeMetrics(metrics);
  resetIfNeeded(config);
}

export function teardown() {
  captureConsistency(config, metrics);
}

export default function () {
  runReservationScenario(config, metrics, reservationResponseCallback);
}
