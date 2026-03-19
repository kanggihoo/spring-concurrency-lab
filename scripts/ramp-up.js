/**
 * 시나리오 3: 점진적 증가 — 한계점(Breaking Point) 탐색
 * - 10 → 50 → 100 → 200 → 500 VU 순으로 단계적 증가
 * - 목적: "몇 VU부터 에러율이 급등하는가?" 임계점을 찾는다
 *         각 Phase마다 같은 스크립트로 실행해 비교
 *
 * 실행:
 *   docker compose -f docker-compose.monitoring.yml --profile k6 run --rm \
 *   k6 run --out experimental-prometheus-rw /scripts/ramp-up.js
 */

import http from "k6/http";
import { check } from "k6";

const BASE_URL = "http://host.docker.internal:8080";

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "30s", target: 50  }, // 10 → 50 VU
        { duration: "30s", target: 100 }, // 50 → 100 VU
        { duration: "30s", target: 200 }, // 100 → 200 VU
        { duration: "30s", target: 500 }, // 200 → 500 VU
      ],
    },
  },
  thresholds: {
    // 임계점 탐색이 목적이므로 threshold를 넉넉하게 설정
    // Grafana에서 에러율 급등 구간을 시각적으로 확인
    http_req_failed:   ["rate<0.5"],
    http_req_duration: ["p(95)<5000"],
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
    "status 409 (sold out)": (r) => r.status === 409,
  });
}
