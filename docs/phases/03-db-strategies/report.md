# Phase 3 보고서: PostgreSQL 기반 예약 동시성 전략 비교

## 총평

Phase 3는 하나의 Concert에 동시에 Reservation 요청이 몰릴 때 `Remaining Seats` 차감 정합성을 어떤 PostgreSQL 전략으로 지킬 수 있는지 비교한 실험이다. 이번 근거 보강에서는 단순 결과 요약이 아니라 k6 요약 JSON, SQL snapshot, Prometheus `pg_locks_count` lock activity JSON, Grafana 실행 구간 JSON을 서로 연결해 `report.md`만 읽어도 실험 목적, 가설, 측정 조건, 주요 지표, 의사결정 근거를 방어할 수 있게 정리했다.

결론은 이번 기준 부하 조건에서는 **원자적 조건부 UPDATE**가 가장 적합하다는 것이다. 세 전략 모두 counted-seat invariant를 지켰지만, 원자적 조건부 UPDATE는 retry exhausted 응답 없이 가장 높은 RPS와 가장 낮은 p95/p99를 기록했다.

## 문제 인식

콘서트 예약은 한정 자원인 좌석 수를 여러 사용자가 동시에 차감하는 문제다. 이 프로젝트의 도메인 모델은 개별 좌석 번호가 아니라 Concert의 `Remaining Seats` 숫자를 관리하는 counted-seat 모델이다. 따라서 핵심 불변식은 다음 두 가지다.

- `reservation_count + remaining_seats == initial_seat_count`
- `reservation_count <= initial_seat_count`

Phase 2의 no-lock 기준 부하는 동시 요청에서 이 불변식이 깨질 수 있음을 보여주는 비교 기준이었다. Phase 3의 목적은 PostgreSQL 기반 전략 세 가지가 같은 기준 부하에서 이 불변식을 지키는지, 그리고 정합성을 얻기 위해 어떤 처리량/지연 시간/운영 신호 비용을 지불하는지 확인하는 것이다.

## 가설

- 비관적 락은 row-level serialization으로 정합성을 지키지만, lock wait 때문에 tail latency가 커질 수 있다.
- 낙관적 락 + 재시도는 정합성을 지키면서 비관적 락보다 처리량이 높을 수 있지만, 재시도 한도를 초과한 요청이 `409 optimistic_lock_exhausted`로 노출될 수 있다.
- 원자적 조건부 UPDATE는 `remaining_seats > 0` 조건을 단일 SQL update의 성공 조건으로 사용하므로, 재시도 loop 없이 정합성과 처리량을 동시에 얻을 가능성이 높다.

## 실험 설계

| 항목 | 값 |
| --- | --- |
| 실행일 | 2026-05-30 KST |
| 애플리케이션 profile | `local` |
| 데이터베이스 | Docker Compose의 PostgreSQL 17 |
| 대상 Concert | Concert 1 |
| Initial Seat Count | 100 |
| 부하 도구 | k6 + Prometheus remote write |
| 실행 방식 | 전략별 순차 실행 |
| VU / duration | 100 constant VUs / 10초 |
| reset 정책 | 각 전략 실행 전 `resetBeforeRun=true` |
| expected HTTP status | `200`, `409` |
| 측정 전략 | 비관적 락, 낙관적 락 + 재시도, 원자적 조건부 UPDATE |

각 전략은 같은 Concert 1을 대상으로 실행하지만, 전략별 실행 전에 DB 상태를 초기화한다. 따라서 세 전략은 서로 다른 잔여 좌석 상태나 lock 상태의 영향을 받지 않는다.

## 데이터 개요

실험 데이터는 `/api/test/reset`으로 생성되는 고정 데이터다.

- Concert: 1개
- Initial Seat Count: 100
- 초기 Remaining Seats: 100
- 초기 Reservation 수: 0
- 성공한 Reservation은 실제 `reservation` row로 기록된다.
- 실험 종료 후 SQL snapshot으로 `reservation_count`, `remaining_seats`, `seat_count_inconsistency`, `overbooked`를 검증한다.

이 phase는 counted-seat 전략 비교가 목적이므로 개별 좌석 번호, 중복 User 방지, idempotency key, Redis 분산락은 범위 밖이다.

## 측정 지표와 원자료 기준

| 지표 | 의미 | 판단 기준 원자료 |
| --- | --- | --- |
| RPS | HTTP 요청 처리량 | k6 요약 JSON의 `http_reqs.rate` |
| p95 / p99 | HTTP 요청 지연 시간 percentile, ms | k6 요약 JSON의 `http_req_duration` |
| HTTP failure rate | k6 expected status 기준 실패율 | k6 요약 JSON과 k6 terminal log |
| `reservation_reserved` | `200 {"status":"reserved"}` 응답 수 | k6 custom counter |
| `reservation_sold_out` | `409 {"status":"sold_out"}` 응답 수 | k6 custom counter |
| `reservation_optimistic_lock_exhausted` | `409 {"status":"optimistic_lock_exhausted"}` 응답 수 | k6 custom counter |
| `reservation_unexpected_status` | expected contract 밖의 status/body 응답 수 | k6 custom counter |
| Seat Count Inconsistency | counted-seat invariant 위반 수 | SQL consistency snapshot |
| Overbooking | 성공 Reservation 수가 Initial Seat Count를 초과했는지 | SQL consistency snapshot |
| Lock activity | PostgreSQL lock activity 신호 | Prometheus `pg_locks_count` JSON |
| Lock wait snapshot | 실행 중 blocking/wait row 포착 여부 | `pg_stat_activity`, `pg_locks` SQL snapshot |

Grafana stitched dashboard는 시각 증거로만 사용한다. 보고서의 핵심 숫자는 k6 요약 JSON과 SQL snapshot을 우선한다. Prometheus는 `pg_locks_count` lock activity와 실행 구간 보조 지표 확인에만 사용한다.

## 핵심 결과

| 전략 | RPS | p95 ms | p99 ms | HTTP failure rate | Reserved | Sold Out | Optimistic Exhausted | Unexpected | Seat Inconsistency | Overbooking | Lock Activity |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 비관적 락 | 933.83 | 210.42 | 488.61 | 0.00% | 100 | 9486 | 0 | 0 | 0 | false | `pg_locks_count` max 16, lock wait snapshot 있음 |
| 낙관적 락 + 재시도 | 1541.40 | 192.15 | 417.56 | 0.00% | 100 | 15430 | 93 | 0 | 0 | false | N/A |
| 원자적 조건부 UPDATE | 2315.40 | 114.93 | 200.86 | 0.00% | 100 | 23261 | 0 | 0 | 0 | false | N/A |

세 전략 모두 최종 상태는 `reservation_count=100`, `remaining_seats=0`, `seat_count_inconsistency=0`, `overbooked=false`였다. 즉 정합성 기준만 보면 세 전략 모두 Phase 3 기준 부하를 통과했다.

성능 기준에서는 원자적 조건부 UPDATE가 가장 강했다. 비관적 락 대비 RPS는 약 2.48배 높고, p99는 488.61 ms에서 200.86 ms로 낮았다. 낙관적 락 + 재시도도 비관적 락보다 처리량은 높았지만, `optimistic_lock_exhausted`가 93건 발생했다.

표의 response classification 값은 Reservation endpoint 본 요청만 센다. k6의 `http_reqs`에는 setup의 `/api/test/reset` 1건과 teardown의 `/api/test/consistency` 1건도 포함되므로, 각 전략의 `http_reqs`는 response classification 합계보다 2 크다.

| 전략 | `http_reqs` | Reservation response classification 합계 | 차이 | 차이 설명 |
| --- | ---: | ---: | ---: | --- |
| 비관적 락 | 9588 | 9586 | 2 | setup reset 1건 + teardown consistency 1건 |
| 낙관적 락 + 재시도 | 15625 | 15623 | 2 | setup reset 1건 + teardown consistency 1건 |
| 원자적 조건부 UPDATE | 23363 | 23361 | 2 | setup reset 1건 + teardown consistency 1건 |

## 근거 자료 목록

| 전략 | k6 요약 JSON | 실행 로그 | SQL snapshot | Prometheus 보조 지표 JSON | Grafana |
| --- | --- | --- | --- | --- | --- |
| 비관적 락 | `docs/evidence/03-db-strategies/pessimistic-lock/k6/phase3-pessimistic-baseline-prometheus-20260530-173018-summary.json` | `docs/evidence/03-db-strategies/pessimistic-lock/logs/phase3-pessimistic-baseline-prometheus-20260530-173018.log` | `docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt`, `docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-stat-activity.txt`, `docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-lock-summary.txt` | `docs/evidence/03-db-strategies/pessimistic-lock/prometheus/k6-window-summary.json`, `docs/evidence/03-db-strategies/pessimistic-lock/prometheus/pg-locks-count.json` | `docs/evidence/03-db-strategies/pessimistic-lock/grafana/run-window-phase3-pessimistic-baseline-prometheus-20260530-173018.json`, `docs/evidence/03-db-strategies/pessimistic-lock/grafana/stitched-dashboard.png` |
| 낙관적 락 + 재시도 | `docs/evidence/03-db-strategies/optimistic-lock/k6/phase3-optimistic-baseline-prometheus-20260530-173116-summary.json` | `docs/evidence/03-db-strategies/optimistic-lock/logs/phase3-optimistic-baseline-prometheus-20260530-173116.log` | `docs/evidence/03-db-strategies/optimistic-lock/sql/baseline-consistency.txt` | `docs/evidence/03-db-strategies/optimistic-lock/prometheus/k6-window-summary.json` | `docs/evidence/03-db-strategies/optimistic-lock/grafana/run-window-phase3-optimistic-baseline-prometheus-20260530-173116.json`, `docs/evidence/03-db-strategies/optimistic-lock/grafana/stitched-dashboard.png` |
| 원자적 조건부 UPDATE | `docs/evidence/03-db-strategies/atomic-update/k6/phase3-atomic-baseline-prometheus-20260530-173143-summary.json` | `docs/evidence/03-db-strategies/atomic-update/logs/phase3-atomic-baseline-prometheus-20260530-173143.log` | `docs/evidence/03-db-strategies/atomic-update/sql/baseline-consistency.txt` | `docs/evidence/03-db-strategies/atomic-update/prometheus/k6-window-summary.json` | `docs/evidence/03-db-strategies/atomic-update/grafana/run-window-phase3-atomic-baseline-prometheus-20260530-173143.json`, `docs/evidence/03-db-strategies/atomic-update/grafana/stitched-dashboard.png` |

## 테스트 및 계약 검증 근거

API 응답 계약은 `ReservationControllerTest`에서 고정했다. 이 테스트는 비관적 락의 `200 reserved`, `409 sold_out`, `408 lock_timeout`, 낙관적 락의 `409 optimistic_lock_exhausted`, 원자적 조건부 UPDATE의 `409 sold_out` 응답 body를 확인한다.

사전 Gradle 테스트 evidence는 `docs/evidence/03-db-strategies/test/gradle-test-20260530-172952.log`에 저장되어 있고, 해당 로그는 `BUILD SUCCESSFUL in 23s`를 기록한다. 따라서 이번 보고서의 API 응답 계약과 baseline 실행은 테스트 성공 로그와 함께 추적할 수 있다.

## 주장 -> 근거 자료 매트릭스

| 주장 | 근거 | 판단 |
| --- | --- | --- |
| 세 전략 모두 counted-seat invariant를 지켰다. | 각 전략의 `sql/baseline-consistency.txt`: `reservation_count=100`, `remaining_seats=0`, `seat_count_inconsistency=0`, `overbooked=f` | 충분 |
| `409`는 단순 실패가 아니라 body status로 분류했다. | `k6/reservation-test.js`의 response classification counter, 각 k6 summary의 `reservation_sold_out`, `reservation_optimistic_lock_exhausted`, `reservation_unexpected_status` | 충분 |
| API 응답 계약은 테스트로 고정했다. | `concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java`, `docs/evidence/03-db-strategies/test/gradle-test-20260530-172952.log` | 충분 |
| 원자적 조건부 UPDATE가 이번 기준 부하에서 가장 빠르다. | atomic k6 summary: RPS 2315.40, p95 114.93 ms, p99 200.86 ms. 다른 두 전략보다 모두 우수 | 충분 |
| 낙관적 락 + 재시도는 호출자에게 보이는 retry exhaustion trade-off가 있다. | optimistic k6 summary: `reservation_optimistic_lock_exhausted=93` | 충분 |
| 비관적 락은 lock wait가 실제로 관측됐다. | `pessimistic-lock/sql/pg-stat-activity.txt`: `wait_event_type=Lock`, blocking PID 존재. `pg-lock-summary.txt`: `tuple concert ExclusiveLock granted=f count=7` | 충분 |
| 비관적 락은 lock activity가 있었다. | `pessimistic-lock/prometheus/pg-locks-count.json`: extracted value 16 | 충분 |
| 예상 밖 응답은 없었다. | 각 k6 summary: `reservation_unexpected_status=0`, k6 log: `checks_failed=0` | 충분 |
| k6 threshold는 terminal log 기준 통과했다. | 각 `.log`: `http_req_duration p(95)<1000`, `http_req_failed rate<0.01` 모두 check 표시 | 부분. summary JSON의 threshold boolean은 `false`로 남아 있어 원자료 불일치로 별도 기록한다. |

## 지표 및 이상 징후

### 정상으로 해석한 지표

- 세 전략 모두 `http_req_failed=0.00%`이고 `reservation_unexpected_status=0`이다.
- 세 전략 모두 SQL consistency snapshot에서 Seat Count Inconsistency와 Overbooking이 없다.
- 비관적 락은 lock wait snapshot과 lock summary가 같은 방향을 가리킨다. `pg_stat_activity`에는 `Lock` wait row와 blocking PID가 있고, `pg_locks`에는 `concert` tuple `ExclusiveLock` 대기 row가 있다.

### 주의해서 해석해야 하는 지표

- k6 요약 JSON의 `http_req_duration.thresholds["p(95)<1000"]` 값은 `false`로 저장되어 있지만, 동일 실행의 terminal log에는 threshold가 통과한 것으로 출력된다. 이 보고서는 threshold 통과 여부를 terminal log 기준으로만 언급하고, 결과 표에는 threshold boolean을 사용하지 않는다.
- k6 `http_reqs`와 response classification counter 합계는 전략마다 2건 차이 난다. 이는 setup reset 요청과 teardown consistency 요청이 `http_reqs`에는 포함되고 Reservation response classification에는 포함되지 않기 때문이다.
- 이 phase에서는 SQL `EXPLAIN ANALYZE`를 사용하지 않았다. 전략 비교의 핵심이 query plan tuning이 아니라 동시성 제어 방식의 정합성과 런타임 지표 비교이기 때문이다.

## 전략별 분석

### 비관적 락

비관적 락은 `SELECT ... FOR UPDATE` 계열 row lock으로 Concert row 접근을 직렬화한다. 결과적으로 counted-seat invariant는 보장됐지만, 세 전략 중 RPS가 가장 낮고 p99가 가장 높았다. 실행 중 snapshot에서도 lock wait와 blocking chain이 포착되어 tail latency 증가 원인을 설명할 수 있다.

이 전략은 정합성 기준을 설명하기 쉽고 실패 양상이 단순하다는 장점이 있다. 그러나 같은 Concert에 요청이 몰리는 상황에서는 DB row lock 대기가 병목이 되므로, 고처리량 기본 전략으로 쓰기에는 비용이 크다.

### 낙관적 락 + 재시도

낙관적 락 + 재시도는 비관적 락보다 높은 RPS와 낮은 p99를 기록했다. 하지만 93건의 요청이 `409 optimistic_lock_exhausted`로 분류됐다. 이는 HTTP failure는 아니지만, 사용자 입장에서는 sold out과 다른 의미의 거절이다.

이 전략은 엔티티를 로드한 뒤 여러 비즈니스 검증을 함께 수행해야 하는 흐름에서는 여전히 선택지가 될 수 있다. 다만 retry exhausted 응답 비율은 운영 지표로 반드시 관리해야 한다.

### 원자적 조건부 UPDATE

원자적 조건부 UPDATE는 다음 조건을 단일 SQL update의 성공 조건으로 사용한다.

```sql
UPDATE concert
SET remaining_seats = remaining_seats - 1
WHERE id = :concert_id
  AND remaining_seats > 0
```

update count가 1이면 Reservation을 생성하고, 0이면 sold out으로 처리한다. 이번 기준 부하에서는 이 방식이 정합성을 지키면서도 가장 높은 RPS와 가장 낮은 p95/p99를 기록했다. 별도 retry exhausted 응답도 없었다.

이 전략의 제약은 비즈니스 로직이 단순한 counted-seat decrement에 잘 맞을 때 가장 강하다는 점이다. Reservation 생성 전에 복잡한 도메인 검증이나 외부 상태 확인이 필요해지면, 단일 update gate만으로 표현하기 어려운 요구사항이 생길 수 있다.

## 의사결정

이번 Phase 3 기준 부하에서는 **원자적 조건부 UPDATE를 기본 DB 전략으로 선택한다.**

근거는 다음과 같다.

- 세 전략 모두 정합성은 지켰지만, 원자적 조건부 UPDATE가 RPS, p95, p99에서 모두 가장 좋았다.
- 원자적 조건부 UPDATE는 retry exhausted 응답이 없었다.
- 비관적 락은 lock wait가 실제로 관측됐고 tail latency가 가장 높았다.
- 낙관적 락 + 재시도는 성능은 중간 수준이지만 `optimistic_lock_exhausted`라는 호출자에게 보이는 trade-off가 있었다.

운영 선택지는 다음처럼 정리한다.

- 기본 counted-seat Reservation 경로: 원자적 조건부 UPDATE
- 엔티티 기반 복잡한 도메인 검증이 필요한 경로: 낙관적 락 + 재시도 후보
- 명시적 직렬화와 단순한 correctness reference가 필요한 검증/운영 경로: 비관적 락 후보

## 한계

- 100 VUs, 10초, Concert 1개에 대한 단일 기준 부하다. 긴 지속 부하, spike 부하, ramp-up/ramp-down은 포함하지 않았다.
- connection pool size matrix와 lock timeout 정책은 Phase 4 범위로 남겼다.
- 같은 User의 중복 Reservation 방지, idempotency key, Redis 분산락은 이 phase의 범위 밖이다.
- SQL `EXPLAIN ANALYZE` 기반 query plan 분석은 수행하지 않았다. 이 phase는 SQL plan tuning보다 동시성 제어 전략의 correctness/performance 비교에 초점을 둔다.

## 면접 방어 포인트

- 왜 HTTP `409`를 실패율로 보지 않았는가?
  sold out과 optimistic retry exhausted는 Phase 3 기준 부하에서 기대 가능한 비즈니스 결과이기 때문이다. 대신 body status를 분류해 `sold_out`, `optimistic_lock_exhausted`, `unexpected_status`를 따로 집계했다.

- 왜 Atomic을 기본 전략으로 선택했는가?
  같은 데이터와 같은 부하 조건에서 세 전략 모두 정합성을 지켰고, Atomic이 가장 높은 RPS와 가장 낮은 p95/p99를 기록했으며 retry exhausted가 없었기 때문이다.

- 비관적 락의 병목을 어떻게 증명했는가?
  k6 p99가 가장 높았고, 실행 중 `pg_stat_activity`와 `pg_locks` snapshot에서 `Lock` wait, blocking PID, `granted=f` tuple lock row가 포착됐다.

## Docusaurus `portfolio.mdx` 제안

상태: 작성 가능. 단, 공개용 문서에서는 이 보고서를 반복하지 말고 `전체 기술 보고서: ./report.md` 링크를 두고 핵심 스토리만 압축하는 편이 낫다.

추천 구조:

- 문제: counted-seat Reservation에서 동시 차감 정합성이 깨지는 이유
- 접근: 비관적 락, 낙관적 락 + 재시도, 원자적 조건부 UPDATE 비교
- 실험: 100 VUs / 10초 / 100 seats / 전략별 초기화
- 결과: RPS, p95, p99, response classification, invariant 결과 표
- 결정: Atomic을 기본 전략으로 선택한 이유
- 운영 학습: lock wait, retry exhaustion, 관측 원자료의 중요성
- 한계와 다음 단계: connection pool pressure, lock timeout, 지속 부하

시각화 후보:

- 전략별 RPS/p95/p99 bar chart
- response classification stacked bar chart
- 주장 -> 근거 자료 표
- Grafana stitched dashboard 이미지

## 다음 단계

Phase 4에서는 connection pool pressure, lock timeout, 지속 부하를 분리해서 측정해야 한다. Phase 3에서 남긴 summary threshold boolean 불일치는 관측 pipeline 검증 항목으로 다룬다.
