import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Gauge } from "k6/metrics";

const presetPath = __ENV.PRESET || "presets/baseline.json";
const preset = JSON.parse(open(presetPath));
const baseUrl = __ENV.BASE_URL || preset.baseUrl || "http://host.docker.internal:8080";
const reservationPath = preset.path || "/api/reservations";
const expectedStatuses = preset.expectedStatuses || [200, 409];
const reservationResponseCallback = http.expectedStatuses(...expectedStatuses);

const reservedResponses = new Counter("reservation_reserved");
const soldOutResponses = new Counter("reservation_sold_out");
const lockTimeoutResponses = new Counter("reservation_lock_timeout");
const unexpectedResponses = new Counter("reservation_unexpected_status");
const reservationCount = new Gauge("concert_reservation_count");
const remainingSeats = new Gauge("concert_remaining_seats");
const seatCountInconsistency = new Gauge("concert_seat_count_inconsistency");
const overbooked = new Gauge("concert_overbooked");

function requiredString(name) {
  const value = preset[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Preset ${presetPath} must define non-empty string field: ${name}`);
  }
  return value;
}

function buildScenario() {
  const executor = requiredString("executor");

  if (executor === "constant-vus") {
    return {
      executor,
      vus: preset.vus,
      duration: preset.duration,
    };
  }

  if (executor === "ramping-vus") {
    return {
      executor,
      startVUs: preset.startVUs || 0,
      stages: preset.stages,
    };
  }

  throw new Error(`Unsupported executor in ${presetPath}: ${executor}`);
}

const phase = requiredString("phase");
const scenario = requiredString("scenario");
const presetName = requiredString("preset");
const pool = __ENV.POOL || requiredString("pool");

export const options = {
  tags: {
    phase,
    scenario,
    preset: presetName,
    pool,
  },
  scenarios: {
    [scenario]: buildScenario(),
  },
  thresholds: preset.thresholds || {},
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

export function setup() {
  if (preset.resetBeforeRun === false) {
    return;
  }

  const res = http.post(`${baseUrl}/api/test/reset`);
  check(res, {
    "reset OK": (r) => r.status === 200,
  });
}

export function teardown() {
  if (preset.captureConsistency === false) {
    return;
  }

  const res = http.get(`${baseUrl}/api/test/consistency`);
  check(res, {
    "consistency snapshot OK": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    return;
  }

  let snapshot;
  try {
    snapshot = res.json();
  } catch (error) {
    console.error(`Failed to parse consistency snapshot JSON: ${error}`);
    return;
  }

  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    console.error("Consistency snapshot JSON is not an object");
    return;
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
    return;
  }

  if (typeof snapshot.overbooked !== "boolean") {
    console.error("Consistency snapshot has missing or non-boolean field: overbooked");
    return;
  }

  reservationCount.add(snapshot.reservationCount);
  remainingSeats.add(snapshot.remainingSeats);
  seatCountInconsistency.add(snapshot.seatCountInconsistency);
  overbooked.add(snapshot.overbooked ? 1 : 0);
}

export default function () {
  const res = http.post(
    `${baseUrl}${reservationPath}`,
    JSON.stringify({
      concertId: preset.concertId || 1,
      userId: __VU,
    }),
    {
      headers: { "Content-Type": "application/json" },
      responseCallback: reservationResponseCallback,
    },
  );

  check(res, {
    "status is expected": (r) => expectedStatuses.includes(r.status),
  });

  if (res.status === 200) {
    reservedResponses.add(1);
  } else if (res.status === 409) {
    soldOutResponses.add(1);
  } else if (res.status === 408) {
    lockTimeoutResponses.add(1);
  } else {
    unexpectedResponses.add(1);
  }

  if (preset.sleepSeconds > 0) {
    sleep(preset.sleepSeconds);
  }
}
