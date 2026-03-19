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
import { check, sleep } from "k6";

// 테스트 대상 엔드포인트
// 도커 컨테이너 내부에서 로컬 Spring Boot 서버에 접근하기 위해 host.docker.internal 사용
const BASE_URL = "http://host.docker.internal:8080";

export const options = {
  scenarios: {
    baseline: {
      executor: "constant-vus",
      vus: 100,        // 100명 동시 요청
      duration: "10s",
    },
  },
  thresholds: {
    http_req_failed:   ["rate<0.01"],   // 에러율 1% 미만
    http_req_duration: ["p(95)<1000"],  // 95%ile 응답시간 1초 미만
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/reservations`,
    JSON.stringify({ concertId: 1, userId: __VU }),
    { headers: { "Content-Type": "application/json" } },
  );

  check(res, {
    "status 200": (r) => r.status === 200,
    "status 409 (sold out)": (r) => r.status === 409, // 재고 소진 시 정상 응답
  });
}
