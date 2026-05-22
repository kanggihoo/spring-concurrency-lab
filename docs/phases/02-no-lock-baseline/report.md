# 리포트

## 요약

Phase 2 no-lock baseline 흐름에서 Grafana provisioning, k6 Prometheus remote write,
SQL 증거, Grafana 대시보드 캡처를 모두 활성화한 상태로 측정했다.

## k6 결과

| 시나리오 | VU | RPS | p95 | p99 | 오류율 | 증거 |
|---|---:|---:|---:|---:|---:|---|
| baseline | 100 | 약 1,219 req/s | 현재 remote-write series에서 미출력 | 0.649 s | 0.00% (`200`/`409`를 기대 응답으로 처리한 뒤) | Prometheus `k6_http_reqs_total`, `k6_http_req_failed_rate`, `k6_http_req_duration_p99`; Grafana capture parts |

## 정합성 결과

| 예약 수 | 차감된 좌석 수 | 좌석 수 불일치 | 증거 |
|---:|---:|---:|---|
| 1132 | 100 | 1032 | `docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt`; `k6_concert_seat_count_inconsistency=1032` |

## 관찰

- no-lock baseline에서 좌석 수 불일치가 발생했다. 성공한 예약은 1132건이고,
  초기 좌석 수 100석에서 남은 좌석은 0석까지 감소했다.
- Raw SQL 증거에서 Overbooking이 확인됐다.
- k6는 처음에 도메인상 정상 결과인 `409 sold out` 응답을 HTTP 실패로 집계했다.
  이후 예약 요청에서 `200`과 `409`를 기대 응답으로 처리하도록 수정했고,
  수정 후 baseline은 `http_req_failed=0.00%`로 완료됐다.
- Grafana 대시보드 캡처가 완료됐고, 스크린샷 3개와 `capture-meta.json`이 생성됐다.

## 결정

이번 실행 결과를 Phase 2 no-lock baseline 증거로 사용한다. Phase 3 비교에서는
좌석 수 불일치와 Overbooking을 줄이는지 확인하면서, Grafana에서 지연 시간과 요청
처리량을 함께 관찰한다.

## 다음 단계 입력

Phase 3에서는 DB 기반 동시성 제어 전략을 적용한 결과를 이 baseline 수치와 비교한다.
