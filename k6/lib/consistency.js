import { check } from "k6";
import http from "k6/http";

function parseConsistencySnapshot(response) {
  let snapshot;
  try {
    snapshot = response.json();
  } catch (error) {
    console.error(`Failed to parse consistency snapshot JSON: ${error}`);
    return null;
  }

  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    console.error("Consistency snapshot JSON is not an object");
    return null;
  }

  const numericFields = [
    "reservationCount",
    "remainingSeats",
    "seatCountInconsistency",
  ];
  const missingNumericFields = numericFields.filter(
    (field) => !Number.isFinite(snapshot[field]),
  );

  if (missingNumericFields.length > 0) {
    console.error(
      `Consistency snapshot has missing or non-numeric fields: ${missingNumericFields.join(", ")}`,
    );
    return null;
  }

  if (typeof snapshot.overbooked !== "boolean") {
    console.error("Consistency snapshot has missing or non-boolean field: overbooked");
    return null;
  }

  return snapshot;
}

function recordConsistencySnapshot(metrics, snapshot) {
  metrics.reservationCount.add(snapshot.reservationCount);
  metrics.remainingSeats.add(snapshot.remainingSeats);
  metrics.seatCountInconsistency.add(snapshot.seatCountInconsistency);
  metrics.overbooked.add(snapshot.overbooked ? 1 : 0);
}

export function resetIfNeeded(config) {
  if (!config.resetBeforeRun) {
    return;
  }

  const res = http.post(`${config.baseUrl}/api/test/reset`);
  check(res, {
    "reset OK": (r) => r.status === 200,
  });
}

export function captureConsistency(config, metrics) {
  if (!config.captureConsistency) {
    return;
  }

  const res = http.get(`${config.baseUrl}/api/test/consistency`);
  check(res, {
    "consistency snapshot OK": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    return;
  }

  const snapshot = parseConsistencySnapshot(res);
  if (snapshot === null) {
    return;
  }

  recordConsistencySnapshot(metrics, snapshot);
}
