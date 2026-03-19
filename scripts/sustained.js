/**
 * 시나리오 4: 지속 부하 — 안정성 검증 (Soak Test)
 * - 200 VU로 5분간 지속 요청
 * - 목적: 장시간 부하에서 커넥션 풀 고갈, 메모리 누수, 성능 저하가 없는지 확인
 *         Grafana에서 hikaricp_connections_active 지표를 함께 모니터링
 *
 * 실행:
 *   docker compose -f docker-compose.monitoring.yml --profile k6 run --rm \
 *   k6 run --out experimental-prometheus-rw /scripts/sustained.js
 */

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = "http://host.docker.internal:8080";

export const options = {
  scenarios: {
    sustained: {
      executor: "constant-vus",
      vus: 200,
      duration: "5m",
    },
  },
  thresholds: {
    http_req_failed:   ["rate<0.01"],   // 에러율 1% 미만을 5분간 유지해야 통과
    http_req_duration: ["p(95)<2000"],  // 95%ile 응답시간 2초 미만 유지
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

  // 지속 부하 테스트에서는 약간의 딜레이를 줘서 RPS를 조절
  sleep(0.1);
}
