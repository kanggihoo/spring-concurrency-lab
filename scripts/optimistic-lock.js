/**
 * Phase 3: 낙관적 락 부하 테스트
 * - 100 VU, 10초 — baseline.js와 동일 조건으로 비교
 * - POST /api/reservations/optimistic
 *
 * 실행:
 *   docker compose --profile test run --rm k6 run \
 *   --out experimental-prometheus-rw /scripts/optimistic-lock.js
 */

import http from "k6/http";
import { check } from "k6";

const BASE_URL = "http://host.docker.internal:8080";

export const options = {
  scenarios: {
    optimistic: {
      executor: "constant-vus",
      vus: 100,
      duration: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"], // 재시도 초과 실패 허용 (5% 이내)
    http_req_duration: ["p(95)<3000"],
  },
};

// 테스트 전 DB 초기화
export function setup() {
  const res = http.post(`${BASE_URL}/api/test/reset`);
  check(res, {
    "reset OK": (r) => r.status === 200,
  });
}

export default function () {
  const res = http.post(
    `${BASE_URL}/api/reservations/optimistic`,
    JSON.stringify({ concertId: 1, userId: __VU }),
    { headers: { "Content-Type": "application/json" } },
  );

  check(res, {
    "status 200 (reserved)": (r) => r.status === 200,
    "status 409 (sold out)": (r) => r.status === 409,
  });
}
