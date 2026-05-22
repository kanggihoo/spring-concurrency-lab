/**
 * 시나리오 1: 기본 동시 부하
 * - 100명이 10초 동안 동시에 예약 요청
 * - 목적: 각 Phase별 기본 성능 수치 측정 (RPS, p95 응답시간, 에러율)
 *
 * 실행:
 *   docker compose -f docker-compose.monitoring.yml --profile k6 run --rm \
 *   k6 run --out experimental-prometheus-rw /scripts/baseline.js
 */

import http from "k6/http";
import { check } from "k6";
import { Gauge } from "k6/metrics";

// 테스트 대상 엔드포인트
// 도커 컨테이너 내부에서 로컬 Spring Boot 서버에 접근하기 위해 host.docker.internal 사용
const BASE_URL = "http://host.docker.internal:8080";
const reservationResponseCallback = http.expectedStatuses(200, 409);

const reservationCount = new Gauge("concert_reservation_count");
const remainingSeats = new Gauge("concert_remaining_seats");
const seatCountInconsistency = new Gauge("concert_seat_count_inconsistency");
const overbooked = new Gauge("concert_overbooked");

export const options = {
  tags: {
    phase: "phase-02",
    scenario: "no-lock",
    preset: "baseline",
    pool: "default",
  },
  scenarios: {
    "no-lock": {
      executor: "constant-vus",
      vus: 100, // 100명 동시 요청
      duration: "10s", // 10초간 진행
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // 에러율 1% 미만
    http_req_duration: ["p(95)<1000"], // 95%ile 응답시간 1초 미만
  },
};

// Reset data before test — clear reservations and restore remaining seats to 100
export function setup() {
  const res = http.post(`${BASE_URL}/api/test/reset`);
  check(res, {
    "reset OK": (r) => r.status === 200,
  });
}

export function teardown() {
  const res = http.get(`${BASE_URL}/api/test/consistency`);
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
    `${BASE_URL}/api/reservations`,
    JSON.stringify({ concertId: 1, userId: __VU }),
    {
      headers: { "Content-Type": "application/json" },
      responseCallback: reservationResponseCallback,
    },
  );

  check(res, {
    "status 200 or 409": (r) => r.status === 200 || r.status === 409,
  });
}
