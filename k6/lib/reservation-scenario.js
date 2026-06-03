import { check, sleep } from "k6";
import http from "k6/http";
import {
  classifyReservationResponse,
  recordReservationClassification,
} from "./response-classifier.js";

function buildReservationRequestBody(config) {
  return JSON.stringify({
    concertId: config.concertId,
    userId: __VU,
  });
}

export function runReservationScenario(config, metrics, responseCallback) {
  const res = http.post(
    `${config.baseUrl}${config.reservationPath}`,
    buildReservationRequestBody(config),
    {
      headers: { "Content-Type": "application/json" },
      responseCallback,
    },
  );

  check(res, {
    "status is expected": (r) => config.expectedStatuses.includes(r.status),
  });

  const classification = classifyReservationResponse(res);
  recordReservationClassification(metrics, classification);

  if (config.sleepSeconds > 0) {
    sleep(config.sleepSeconds);
  }
}
