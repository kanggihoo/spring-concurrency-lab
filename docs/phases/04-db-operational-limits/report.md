# Report

## Summary

Phase 4는 Phase 3에서 확인한 DB 기반 Reservation 전략을 같은 부하 조건에서 운영 파라미터별로 비교한다. 모든 실행은 Concert 1, Initial Seat Count 100, 100 VUs, 10초 반복 요청으로 수행했다.

측정값 출처는 다음과 같다.

- RPS, p95, p99, iterations, k6 HTTP failure rate는 k6 summary JSON에서 읽었다.
- `reserved`, `sold_out`, `lock_timeout`, `unexpected` 응답 수는 k6 custom counter에서 읽었다.
- Hikari Pending/Active/Max는 각 run-window의 `prometheus/hikari-summary.json`에 저장된 Prometheus query result에서 읽었다.
- Seat Count Inconsistency와 Overbooking은 각 조건의 `sql/consistency.txt`로 확인했다.
- Pessimistic Lock의 row lock wait는 `pg-lock-wait-snapshot.txt`, `pg-lock-summary.txt`로 확인했다.

모든 조건에서 최종 상태는 Reservation 100건, Remaining Seats 0, Seat Count Inconsistency 0, Overbooking `false`였다. 따라서 Phase 4의 차이는 correctness 차이가 아니라 throughput, tail latency, connection pressure, row lock wait 차이다.

## Atomic Pool Result

| Pool Size | RPS | p95 | p99 | Hikari Pending | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---|
| 2 | 876.90 | 175.94 ms | 346.32 ms | 98 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-2/k6/phase4-atomic-pool-prometheus-pool-2-20260529-114727-summary.json), [hikari](../../evidence/04-db-operational-limits/atomic-pool/pool-2/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-2/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-2/grafana/stitched-dashboard.png) |
| 5 | 1336.57 | 130.31 ms | 293.98 ms | 93 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-5/k6/phase4-atomic-pool-prometheus-pool-5-20260529-114753-summary.json), [hikari](../../evidence/04-db-operational-limits/atomic-pool/pool-5/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-5/sql/consistency.txt) |
| 10 | 1139.19 | 177.86 ms | 504.14 ms | 86 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-10/k6/phase4-atomic-pool-prometheus-pool-10-20260529-114819-summary.json), [hikari](../../evidence/04-db-operational-limits/atomic-pool/pool-10/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-10/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/stitched-dashboard.png) |
| 20 | 1441.55 | 126.45 ms | 293.02 ms | 73 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-20/k6/phase4-atomic-pool-prometheus-pool-20-20260529-114845-summary.json), [hikari](../../evidence/04-db-operational-limits/atomic-pool/pool-20/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-20/sql/consistency.txt) |
| 50 | 1394.80 | 115.39 ms | 275.39 ms | 20 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-50/k6/phase4-atomic-pool-prometheus-pool-50-20260529-114911-summary.json), [hikari](../../evidence/04-db-operational-limits/atomic-pool/pool-50/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-50/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/stitched-dashboard.png) |

Atomic Conditional Update는 모든 pool 조건에서 invariant를 지켰다. 이번 재실행에서는 pool 5, 20, 50이 비슷한 상위 처리량 구간을 형성했고, pool 2는 connection pressure가 가장 컸다. pool 10은 이 실행에서 일시적으로 RPS가 낮았으므로 단일 실행값만으로 최적점이라고 단정하지 않는다.

## Pessimistic Pool Result

| Pool Size | RPS | p95 | p99 | Hikari Pending | Lock Wait Evidence | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---|---:|---:|---|
| 2 | 396.67 | 151.21 ms | 486.02 ms | 76 | representative capture 없음 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/k6/phase4-pessimistic-pool-prometheus-pool-2-20260529-114937-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/grafana/stitched-dashboard.png) |
| 5 | 749.12 | 188.60 ms | 420.51 ms | 94 | representative capture 없음 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-5/k6/phase4-pessimistic-pool-prometheus-pool-5-20260529-115012-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-pool/pool-5/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-5/sql/consistency.txt) |
| 10 | 647.38 | 264.24 ms | 562.84 ms | 89 | [wait snapshot](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-wait-snapshot.txt), [lock summary](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-summary.txt) | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/k6/phase4-pessimistic-pool-prometheus-pool-10-20260529-115038-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/grafana/stitched-dashboard.png) |
| 20 | 759.66 | 197.96 ms | 488.50 ms | 79 | representative capture 없음 | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-20/k6/phase4-pessimistic-pool-prometheus-pool-20-20260529-115101-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-pool/pool-20/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-20/sql/consistency.txt) |
| 50 | 695.33 | 249.12 ms | 612.61 ms | 89 | [wait snapshot](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-wait-snapshot.txt), [lock summary](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-summary.txt) | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/k6/phase4-pessimistic-pool-prometheus-pool-50-20260529-115126-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/grafana/stitched-dashboard.png) |

Pessimistic Lock은 invariant를 지키지만, 동일 Concert row에 요청이 몰리는 workload에서는 row lock serialization이 tail latency를 만든다. `pool-10`, `pool-50` lock snapshot은 대표 구간의 wait event와 lock mode 분포를 저장한다.

## Pessimistic Timeout Result

| Lock Timeout Setting | Reserved | Sold Out | Lock Timeout | Unexpected | p95 | p99 | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 200 ms | 100 | 7223 | 0 | 0 | 267.83 ms | 552.80 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/k6/phase4-pessimistic-timeout-prometheus-timeout-200-20260529-115150-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/sql/consistency.txt) |
| 500 ms | 100 | 8050 | 0 | 0 | 196.87 ms | 533.89 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/k6/phase4-pessimistic-timeout-prometheus-timeout-500-20260529-115215-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/grafana/stitched-dashboard.png) |
| 1000 ms | 100 | 8398 | 0 | 0 | 178.74 ms | 452.13 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/k6/phase4-pessimistic-timeout-prometheus-timeout-1000-20260529-115241-summary.json), [hikari](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/prometheus/hikari-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/sql/consistency.txt) |

이번 sold-out-dominant workload에서는 HTTP 408 `lock_timeout` 응답이 관측되지 않았다. 따라서 이번 evidence만으로 `lock_timeout`이 긴 lock wait를 controlled failure로 바꿨다고 결론내릴 수 없다. 다만 408을 expected status와 counter로 분리했으므로, 이후 timeout-stress 실험에서는 같은 경로로 controlled failure를 직접 검증할 수 있다.

## Decision

Phase 5 Redis 비교의 DB baseline은 Atomic Conditional Update로 둔다.

- 보수적 운영 기준: Atomic Conditional Update, pool size 10
- 처리량 상한 참고 기준: Atomic Conditional Update, pool size 50

Pessimistic Lock은 correctness reference로 유지한다. 단일 counted-seat row에 요청이 몰리는 workload에서는 row lock wait가 명확한 운영 한계로 나타나므로 기본 고처리량 전략으로는 부적합하다.
