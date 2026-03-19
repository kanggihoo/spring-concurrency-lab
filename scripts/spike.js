/**
 * 시나리오 2: 스파이크 테스트 — 순간 폭주
 * - 2초 만에 500명으로 급증 후 유지
 * - 목적: 갑작스러운 트래픽 폭발 시 DB 락/Redis가 어떻게 반응하는지 확인
 *         커넥션 풀 고갈, 에러율 급등 여부 측정
 *
 * 실행:
 *   docker compose -f docker-compose.monitoring.yml --profile k6 run --rm \
 *   k6 run --out experimental-prometheus-rw /scripts/spike.js
 */

import http from "k6/http";
import { check } from "k6";

const BASE_URL = "http://host.docker.internal:8080";

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "5s",  target: 0   }, // 준비 구간
        { duration: "2s",  target: 500 }, // 2초 만에 500명으로 폭주
        { duration: "10s", target: 500 }, // 500명 유지
        { duration: "5s",  target: 0   }, // 점진적 감소
      ],
    },
  },
  thresholds: {
    http_req_failed:   ["rate<0.05"],   // 에러율 5% 미만 (스파이크이므로 기준 완화)
    http_req_duration: ["p(95)<3000"],  // 95%ile 응답시간 3초 미만
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
