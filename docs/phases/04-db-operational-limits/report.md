# Report

## Summary

Phase 4는 Phase 3에서 DB 기반 기본 후보로 남은 **Atomic Conditional Update**와 **Pessimistic Lock**의 운영 한계를 확인했다. 모든 실험은 Phase 3과 같은 부하 형태를 사용했다. k6는 Concert 1에 대해 100 VUs로 10초 동안 예약 요청을 반복했고, Concert의 Initial Seat Count는 100이다.

이번 단계의 질문은 단순히 "정합성이 맞는가"가 아니다. Phase 3에서 이미 Atomic Conditional Update와 Pessimistic Lock이 Seat Count Inconsistency와 Overbooking을 만들지 않는다는 점은 확인했다. Phase 4에서는 같은 정합성 조건을 유지한 채 DB connection pool size, row lock wait, PostgreSQL `lock_timeout`이 처리량과 tail latency에 어떤 영향을 주는지 봤다.

모든 측정 조건에서 최종 상태는 같았다. 성공한 Reservation은 100건, Remaining Seats는 0, Seat Count Inconsistency는 0, Overbooking은 `false`였다. 즉 이번 Phase의 모든 차이는 정합성 차이가 아니라 처리량, 지연 시간, lock wait, pool pressure의 차이다.

측정값 출처는 다음과 같다.

- RPS, p95, iterations, k6 HTTP failure rate는 k6 summary JSON에서 읽었다.
- p99는 k6 summary export에 포함되지 않으므로 run-window 기준 Prometheus `k6_http_req_duration_p99`를 조회했다.
- Hikari Pending은 각 run-window에서 `hikaricp_connections_pending`의 최대값으로 기록했다.
- Seat Count Inconsistency와 Overbooking은 각 조건의 `sql/consistency.txt`를 기준으로 확인했다.
- Pessimistic Lock의 lock wait는 `pg_locks`, `pg_stat_activity` snapshot으로 확인했다.

주의할 점이 있다. p95는 k6 summary의 전체 run aggregate이고, p99는 Prometheus remote write metric을 run-window로 조회한 운영 지표다. 두 값은 집계 방식이 다르므로 일부 행에서는 p99가 k6 p95보다 낮게 보인다. 따라서 p99는 Grafana/Prometheus 관측값으로 참고하고, 같은 행 안에서 p95와 직접적인 분위수 순서 비교를 하지 않는다.

## Atomic Pool Result

Atomic Conditional Update는 `UPDATE ... WHERE remaining_seats > 0` 형태의 조건부 차감으로 좌석을 예약한다. 실패 요청은 이미 좌석이 소진된 뒤의 sold-out 응답이며, 정상적인 고경합 sold-out workload에서는 409가 expected response로 처리된다.

| Pool Size | RPS | p95 | p99 | Hikari Pending | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---|
| 2 | 754.21 | 224.54 ms | 164.42 ms | 97 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-2/k6/phase4-atomic-pool-prometheus-pool-2-20260527-144548-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-2/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-2/grafana/stitched-dashboard.png) |
| 5 | 1397.59 | 115.39 ms | 352.22 ms | 93 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-5/k6/phase4-atomic-pool-prometheus-pool-5-20260527-144721-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-5/sql/consistency.txt) |
| 10 | 1422.08 | 125.37 ms | 645.36 ms | 82 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-10/k6/phase4-atomic-pool-prometheus-pool-10-20260527-144827-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-10/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/stitched-dashboard.png) |
| 20 | 1463.32 | 143.81 ms | 404.60 ms | 71 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-20/k6/phase4-atomic-pool-prometheus-pool-20-20260527-144932-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-20/sql/consistency.txt) |
| 50 | 1917.00 | 73.70 ms | 162.33 ms | 49 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-50/k6/phase4-atomic-pool-prometheus-pool-50-20260527-145038-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-50/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/stitched-dashboard.png) |

Atomic 결과에서 가장 먼저 보이는 변화는 pool 2에서 pool 5로 올릴 때다. RPS가 754.21에서 1397.59로 크게 증가했고, p95도 224.54 ms에서 115.39 ms로 낮아졌다. 이 구간은 connection pool이 명확한 병목이었다고 볼 수 있다.

pool 5에서 pool 10은 RPS가 1397.59에서 1422.08로 소폭 증가하는 정도에 그쳤다. pool 20도 1463.32 RPS로 추가 개선 폭이 작다. 운영 기본값을 보수적으로 잡는다면 pool 10은 이미 주요 개선을 대부분 확보한 지점이다.

pool 50은 이번 로컬 측정에서 1917.00 RPS와 73.70 ms p95로 가장 좋았다. 다만 이 값은 "DB connection을 50개까지 열어도 되는 환경"이라는 전제가 붙는다. 실제 운영 DB의 connection budget, 다른 서비스와의 공유, PostgreSQL max_connections, DB CPU/IO 여유가 함께 검토되지 않으면 pool 50을 곧바로 기본값으로 삼기는 어렵다.

## Pessimistic Pool Result

Pessimistic Lock은 같은 Concert row를 `SELECT ... FOR UPDATE`류의 row lock으로 직렬화한다. 이 방식은 정합성 기준으로는 명확하지만, 고경합 상황에서는 DB row lock wait가 tail latency와 처리량의 주요 원인이 될 수 있다.

| Pool Size | RPS | p95 | p99 | Hikari Pending | Lock Wait Evidence | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---|---:|---:|---|
| 2 | 748.60 | 227.28 ms | 558.62 ms | 97 | 이 조건에서는 snapshot 미수집 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/k6/phase4-pessimistic-pool-prometheus-pool-2-20260527-150515-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/grafana/stitched-dashboard.png) |
| 5 | 762.89 | 192.60 ms | 851.32 ms | 94 | 이 조건에서는 snapshot 미수집 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-5/k6/phase4-pessimistic-pool-prometheus-pool-5-20260527-150621-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-5/sql/consistency.txt) |
| 10 | 727.05 | 205.48 ms | 1182.78 ms | 90 | [pg_locks](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-locks.txt)에 8개 waiting lock row 기록, [pg_stat_activity](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-stat-activity.txt) 저장 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/k6/phase4-pessimistic-pool-prometheus-pool-10-20260527-150813-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/grafana/stitched-dashboard.png) |
| 20 | 799.25 | 179.65 ms | 338.44 ms | 79 | 이 조건에서는 snapshot 미수집 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-20/k6/phase4-pessimistic-pool-prometheus-pool-20-20260527-150921-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-20/sql/consistency.txt) |
| 50 | 522.22 | 427.91 ms | 411.13 ms | 49 | [pg_locks](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-locks.txt)에 48개 waiting lock row 기록, [pg_stat_activity](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-stat-activity.txt) 저장 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/k6/phase4-pessimistic-pool-prometheus-pool-50-20260527-151032-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/grafana/stitched-dashboard.png) |

Pessimistic Lock은 pool size를 키운다고 선형으로 좋아지지 않았다. pool 2, 5, 10, 20은 대략 727-799 RPS 범위에 머물렀고, pool 50에서는 522.22 RPS로 오히려 나빠졌다. p95도 pool 50에서 427.91 ms로 가장 높았다.

이 결과는 Hikari Pending만으로 설명되지 않는다. Hikari Pending은 pool 2에서 97, pool 50에서 49로 낮아졌다. 하지만 DB lock snapshot은 반대 방향의 신호를 보여준다. pool 10에서는 waiting lock row가 8개였고, pool 50에서는 48개였다. 즉 pool을 늘리면 application thread가 connection을 기다리는 시간은 줄어들 수 있지만, 같은 Concert row를 잡기 위해 DB 내부에서 더 많은 transaction이 대기하게 된다.

따라서 Pessimistic Lock의 병목은 connection pool 부족보다 row lock serialization에 더 가깝다. 이 전략은 정합성 확인용 reference로는 유용하지만, 단일 counted-seat row에 요청이 몰리는 workload의 기본 고처리량 전략으로는 부적합하다.

## Pessimistic Timeout Result

이 실험은 Pessimistic Lock 경로에서 PostgreSQL `lock_timeout`을 `200ms`, `500ms`, `1000ms`로 바꾸어 긴 lock wait가 controlled failure로 전환되는지 확인하려는 목적이었다. 서버 실행은 Hikari `connection-init-sql` 대신 PostgreSQL JDBC URL `options=-c lock_timeout=...` 방식으로 적용했다. Spring Boot 4 환경에서는 Hikari pool이 시작된 뒤 `connection-init-sql` setter가 적용되면서 pool sealed 오류가 발생했기 때문이다.

| Lock Timeout Setting | Reserved | Sold Out | Lock Timeout Responses | p95 | p99 | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 200 | 100 | 8094 | 0 | 200.02 ms | 449.97 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/k6/phase4-pessimistic-timeout-prometheus-timeout-200-20260527-151818-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/sql/consistency.txt) |
| 500 | 100 | 7297 | 0 | 258.72 ms | 457.70 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/k6/phase4-pessimistic-timeout-prometheus-timeout-500-20260527-151929-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/grafana/stitched-dashboard.png) |
| 1000 | 100 | 8122 | 0 | 194.63 ms | 492.67 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/k6/phase4-pessimistic-timeout-prometheus-timeout-1000-20260527-152036-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/sql/consistency.txt) |

현재 부하 형태에서는 lock timeout 응답이 관측되지 않았다. 세 조건 모두 100건의 Reservation 성공 이후 나머지 요청은 sold-out으로 처리됐고, k6 HTTP failure rate도 0이었다. 따라서 이번 evidence만으로 "`lock_timeout`이 긴 lock wait를 controlled failure로 바꾼다"고 결론내릴 수 없다.

이 결과는 `lock_timeout` 설정이 무의미하다는 뜻은 아니다. 현재 endpoint의 lock hold time이 timeout보다 짧았거나, 좌석 소진 후 빠르게 sold-out 경로로 수렴했을 가능성이 크다. timeout 정책을 검증하려면 별도의 실험에서 lock을 더 오래 잡는 endpoint, transaction 내 지연, 또는 더 높은 lock hold contention을 만들어야 한다.

## Evidence Notes

- Atomic pool과 Pessimistic pool은 각각 `pool-2`, `pool-5`, `pool-10`, `pool-20`, `pool-50` 조건을 측정했다.
- Pessimistic timeout은 `timeout-200`, `timeout-500`, `timeout-1000` 조건을 측정했다.
- Grafana stitched dashboard는 대표 조건만 저장했다. Atomic pool과 Pessimistic pool은 `pool-2`, `pool-10`, `pool-50`, timeout은 `timeout-500`을 캡처했다.
- 모든 SQL consistency 파일은 `reservation_count = 100`, `remaining_seats = 0`, `seat_count_inconsistency = 0`, `overbooked = f`를 기록했다.
- timeout 결과의 Sold Out은 `iterations - reserved`로 계산했다. 현재 k6 script는 response body별 상세 classification을 별도 metric으로 내보내지 않으므로 `lock_timeout` 응답 수는 로그와 HTTP failure 결과상 관측되지 않은 값으로 0을 기록했다.

## Findings

Atomic Conditional Update에서 첫 번째 주요 개선 구간은 pool 2에서 pool 5로 올릴 때다. 이때 RPS가 거의 두 배 가까이 증가했고 p95도 크게 낮아졌다. pool 5 이후 pool 10과 pool 20은 개선 폭이 작아진다. 운영 기본값 관점에서는 pool 10이 보수적인 균형점이다.

이번 로컬 측정에서 Atomic pool 50은 가장 높은 처리량과 가장 낮은 p95를 보였다. 따라서 Phase 5에서 Redis 전략의 최대 처리량과 비교할 DB throughput ceiling으로는 pool 50을 사용할 수 있다. 다만 pool 50은 DB connection을 그만큼 점유하므로 실제 운영 기본값으로 선택하려면 PostgreSQL connection budget, DB CPU, 다른 workload와의 공유 비용을 함께 봐야 한다.

Pessimistic Lock은 pool을 키운다고 처리량이 안정적으로 좋아지지 않았다. 특히 pool 50은 Hikari Pending이 낮아졌는데도 RPS와 p95가 악화됐다. lock snapshot에서 pool 50의 waiting lock row가 48개로 늘어난 점을 보면, 병목이 application connection 대기에서 DB row lock 대기로 이동했다고 해석하는 것이 맞다.

Pessimistic Lock p99와 lock wait는 관련 신호가 있다. pool 10은 p99가 1182.78 ms이고 waiting lock row가 8개였다. pool 50은 p95가 크게 나빠졌고 waiting lock row가 48개였다. 다만 p99는 Prometheus remote-write 기준이라 k6 p95와 직접 비교하기보다 tail latency 방향성 확인용으로만 사용해야 한다.

`lock_timeout`은 이번 실험에서 controlled failure를 만들지 못했다. `200ms`, `500ms`, `1000ms` 모두 lock timeout response가 관측되지 않았고, 정합성도 모두 정상이다. 이 결과는 timeout 정책의 효과 부재가 아니라 현재 부하 shape이 timeout을 유발할 만큼 긴 lock hold를 만들지 못했다는 의미에 가깝다.

어떤 조건에서도 Seat Count Inconsistency나 Overbooking은 발생하지 않았다. Phase 4의 운영 한계는 correctness failure가 아니라 throughput, tail latency, DB lock wait, connection pressure의 문제로 봐야 한다.

## Decision

Phase 5 Redis 비교의 기본 DB 전략은 Atomic Conditional Update로 둔다. 이 전략은 Phase 3에서 가장 좋은 DB 기본 전략이었고, Phase 4에서도 모든 pool 조건에서 정합성을 유지했다.

DB pool 기준은 두 개로 나누어 기록한다.

- 보수적 운영 기준: Atomic Conditional Update, pool size 10
- 처리량 상한 비교 기준: Atomic Conditional Update, pool size 50

pool size 10은 pool 5 이후의 개선 폭이 작아지는 지점이며 DB connection 사용량을 과도하게 늘리지 않는다. pool size 50은 이번 로컬 실험에서 가장 높은 throughput을 보였으므로 Redis 전략이 DB 상한을 넘어서는지 비교하는 기준으로 유용하다.

Pessimistic Lock은 기본 전략이 아니라 correctness reference로 유지한다. 단일 Concert row에 경합이 몰릴 때 lock wait가 자연스럽게 쌓이고, pool을 크게 늘리면 DB 내부 대기만 증가할 수 있다. 따라서 "정합성은 확실하지만 고경합 counted-seat 차감의 기본 처리 전략으로는 비싸다"는 판단이다.

`lock_timeout`은 lock-heavy path의 guardrail 후보로 남긴다. 다만 이번 Phase 4 evidence는 timeout response를 실제로 관측하지 못했으므로, 운영 정책으로 확정하기 전에 lock hold time을 의도적으로 늘린 별도 검증이 필요하다.

## Next Phase Input

Phase 5는 Redis 기반 전략을 Atomic Conditional Update와 비교해야 한다. 비교 기준은 Phase 3/4와 같은 baseline k6 shape, 즉 100 VUs for 10 seconds, Concert 1, Initial Seat Count 100이다.

Redis 전략은 최소 두 개의 DB baseline과 비교한다.

- Atomic Conditional Update pool size 10: 보수적 DB 운영 기준
- Atomic Conditional Update pool size 50: 이번 Phase 4에서 관측한 DB throughput ceiling

Redis 결과를 해석할 때는 Pessimistic Lock도 참고한다. Pessimistic Lock은 정합성 reference지만 lock wait에 취약했다. Redis 전략이 처리량을 높이더라도 Reservation 100건, Remaining Seats 0, Seat Count Inconsistency 0, Overbooking false라는 counted-seat invariant를 동일하게 만족해야 한다.
