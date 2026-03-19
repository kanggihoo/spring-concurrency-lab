import http from "k6/http";
import { check, sleep } from "k6";

// 1. 타겟 설정 (도커 컨테이너에서 호스트 머신의 Spring Boot 서버 접근)
const BASE_URL = "http://host.docker.internal:8080";

// 2. 가상 사용자(VU) 및 실행 시간 옵션
export const options = {
  vus: 10, // 10명의 가상 사용자
  duration: "10s", // 10초 동안 요청 발생
  thresholds: {
    // 최소한의 성공 기준
    http_req_failed: ["rate<0.01"], // 1% 이하의 에러율 보장
  },
};

// 3. 테스트 시나리오 함수
export default function () {
  // 간단한 API 테스트 (Spring Boot에 구현한 /api/test)
  const res = http.get(`${BASE_URL}/api/test`);

  // 응답 검증 (200 OK 여부)
  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  // 시스템 리소스 고갈 방지
  sleep(0.1);
}
