# 리포트

## 요약

Phase 2 no-lock baseline은 이후 동시성 제어 전략과 비교하기 위한 기준 실행이다. 현재 흐름은 k6, Prometheus, SQL, Grafana evidence를 남길 수 있도록 구성되어 있다.

no-lock 구현은 의도적으로 lost update가 발생할 수 있는 구조다. 따라서 Phase 2의 핵심 evidence는 처리량과 지연 시간뿐 아니라 Seat Count Inconsistency와 Overbooking 발생 여부다.

## k6 결과

| 시나리오 | VU | RPS | p95 | p99 | 오류율 | 증거 |
|---|---:|---:|---:|---:|---:|---|
| baseline | 100 | 1054.47 req/s | 340.28 ms | 403.68 ms | 0.00% | `docs/evidence/02-no-lock-baseline/k6/baseline-prometheus-20260522-171647-summary.json`, `docs/evidence/02-no-lock-baseline/logs/baseline-prometheus-20260522-171647.log`, `docs/evidence/02-no-lock-baseline/grafana/stitched-dashboard.png` |

Phase 2에서는 `200 reserved`와 `409 sold_out`을 모두 정상적인 예약 결과로 본다. 따라서 k6는 두 상태 코드를 모두 expected response로 처리한다.

## 정합성 결과

| Reservation Count | Remaining Seats | Seat Count Inconsistency | 증거 |
|---:|---:|---:|---|
| 1278 | 0 | 1178 | `docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt`; `k6_concert_seat_count_inconsistency` |

## 관찰

- no-lock baseline에서는 Seat Count Inconsistency가 발생해야 한다.
- k6 지연 시간 evidence는 Prometheus remote write trend stats 기준으로 기록한다.
  - `k6_http_req_duration_p95`
  - `k6_http_req_duration_p99`
- Grafana capture는 최신 `run-window-*.json`을 사용해 k6 실행 구간과 동일한 시간 범위로 캡처해야 한다.
- SQL evidence는 최종 DB 정합성을 확인하는 기준 근거다.

## 결정

이번 Phase 2 baseline을 Phase 3 DB 동시성 제어 전략의 비교 기준으로 사용한다. Phase 3에서는 Seat Count Inconsistency와 Overbooking이 줄어드는지 확인하고, 그 대가로 발생하는 지연 시간과 처리량 변화를 이 baseline과 비교한다.

## 다음 Phase 입력

Phase 3에서는 동일한 k6 preset 구조, Prometheus label, SQL consistency query, Grafana evidence 흐름을 재사용해 DB 기반 동시성 제어 전략을 비교한다.
