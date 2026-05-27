# Report

## Summary

Phase 4 measured DB operational limits for the two DB strategies that matter after Phase 3: Atomic Conditional Update and Pessimistic Lock. All runs used the Phase 3/4 baseline k6 shape of 100 VUs for 10 seconds against Concert 1 with 100 initial seats.

All measured conditions preserved the counted-seat invariant: 100 successful Reservations, 0 Remaining Seats, 0 Seat Count Inconsistency, and no Overbooking. The runs were sold-out-dominant after the first 100 successful Reservations.

p95 and RPS come from k6 summary JSON. p99 comes from Prometheus `k6_http_req_duration_p99` over each run-window JSON because the k6 summary export does not include p99. Treat p99 as the Prometheus/Grafana operational signal for the run window, not as a k6 aggregate percentile; in a few rows it is lower than the k6 aggregate p95 because the sources aggregate differently.

## Atomic Pool Result

| Pool Size | RPS | p95 | p99 | Hikari Pending | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---|
| 2 | 754.21 | 224.54 ms | 164.42 ms | 97 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-2/k6/phase4-atomic-pool-prometheus-pool-2-20260527-144548-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-2/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-2/grafana/stitched-dashboard.png) |
| 5 | 1397.59 | 115.39 ms | 352.22 ms | 93 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-5/k6/phase4-atomic-pool-prometheus-pool-5-20260527-144721-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-5/sql/consistency.txt) |
| 10 | 1422.08 | 125.37 ms | 645.36 ms | 82 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-10/k6/phase4-atomic-pool-prometheus-pool-10-20260527-144827-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-10/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/stitched-dashboard.png) |
| 20 | 1463.32 | 143.81 ms | 404.60 ms | 71 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-20/k6/phase4-atomic-pool-prometheus-pool-20-20260527-144932-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-20/sql/consistency.txt) |
| 50 | 1917.00 | 73.70 ms | 162.33 ms | 49 | 0 | false | [k6](../../evidence/04-db-operational-limits/atomic-pool/pool-50/k6/phase4-atomic-pool-prometheus-pool-50-20260527-145038-summary.json), [sql](../../evidence/04-db-operational-limits/atomic-pool/pool-50/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/stitched-dashboard.png) |

## Pessimistic Pool Result

| Pool Size | RPS | p95 | p99 | Hikari Pending | Lock Wait Evidence | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---|---:|---:|---|
| 2 | 748.60 | 227.28 ms | 558.62 ms | 97 | Not captured for this condition | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/k6/phase4-pessimistic-pool-prometheus-pool-2-20260527-150515-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-2/grafana/stitched-dashboard.png) |
| 5 | 762.89 | 192.60 ms | 851.32 ms | 94 | Not captured for this condition | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-5/k6/phase4-pessimistic-pool-prometheus-pool-5-20260527-150621-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-5/sql/consistency.txt) |
| 10 | 727.05 | 205.48 ms | 1182.78 ms | 90 | 8 waiting lock rows in [pg_locks](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-locks.txt); [pg_stat_activity](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-stat-activity.txt) captured | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/k6/phase4-pessimistic-pool-prometheus-pool-10-20260527-150813-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/grafana/stitched-dashboard.png) |
| 20 | 799.25 | 179.65 ms | 338.44 ms | 79 | Not captured for this condition | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-20/k6/phase4-pessimistic-pool-prometheus-pool-20-20260527-150921-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-20/sql/consistency.txt) |
| 50 | 522.22 | 427.91 ms | 411.13 ms | 49 | 48 waiting lock rows in [pg_locks](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-locks.txt); [pg_stat_activity](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-stat-activity.txt) captured | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/k6/phase4-pessimistic-pool-prometheus-pool-50-20260527-151032-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/grafana/stitched-dashboard.png) |

## Pessimistic Timeout Result

| Lock Timeout Setting | Reserved | Sold Out | Lock Timeout Responses | p95 | p99 | Seat Count Inconsistency | Overbooking | Evidence |
|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 200 | 100 | 8094 | 0 | 200.02 ms | 449.97 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/k6/phase4-pessimistic-timeout-prometheus-timeout-200-20260527-151818-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/sql/consistency.txt) |
| 500 | 100 | 7297 | 0 | 258.72 ms | 457.70 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/k6/phase4-pessimistic-timeout-prometheus-timeout-500-20260527-151929-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/sql/consistency.txt), [grafana](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/grafana/stitched-dashboard.png) |
| 1000 | 100 | 8122 | 0 | 194.63 ms | 492.67 ms | 0 | false | [k6](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/k6/phase4-pessimistic-timeout-prometheus-timeout-1000-20260527-152036-summary.json), [sql](../../evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/sql/consistency.txt) |

## Findings

Atomic Conditional Update first stops improving materially at pool size 10: pool 5 to 10 only increased RPS from 1397.59 to 1422.08. Pool 20 also added little throughput. Pool 50 was the exception in this local run, reaching 1917.00 RPS with the lowest observed p95, so it is the measured throughput ceiling for this workload.

Increasing Atomic pool size beyond 10 is not consistently useful until pool 50. Pool 20 does not justify the extra DB concurrency. Pool 50 may be justified for a throughput-ceiling comparison, but it should be validated against the real DB connection budget before being used as a production default.

Pessimistic Lock tail latency is not explained by Hikari pending alone. Hikari pending decreased as pool size grew, but `pg_locks` snapshots showed waiting tuple locks at pool 10 and many more at pool 50. Pool 50 had the worst RPS and p95 despite lower Hikari pending, which points to database row-lock serialization as the limiting factor.

`lock_timeout` did not convert long waits into observed controlled failures in this load shape. All timeout runs completed with 0 k6 HTTP failures and 0 counted lock-timeout responses; the runs still ended as 100 successful Reservations plus sold-out responses.

No condition created Seat Count Inconsistency or Overbooking. Every SQL consistency file recorded `seat_count_inconsistency = 0` and `overbooked = f`.

## Decision

Use Atomic Conditional Update as the DB baseline for Phase 5 Redis comparison. For the measured Phase 4 DB pool setting, use pool size 50 as the throughput-ceiling baseline, while keeping pool size 10 as the conservative operational reference when DB connection budget matters more than maximum local throughput.

Pessimistic Lock remains a correctness reference rather than the default strategy. It preserves consistency, but lock wait evidence and the pool-50 degradation show that adding DB concurrency can amplify serialized row-lock contention instead of improving throughput.

`lock_timeout` should remain a candidate guardrail for lock-heavy paths, but Phase 4 did not show observed lock-timeout responses under the current 100 VU / 10 second shape. A future test should force longer lock hold time before treating timeout behavior as proven.

## Next Phase Input

Phase 5 should compare Redis strategies against Atomic Conditional Update at the selected Phase 4 DB pool setting and the Phase 3/4 baseline k6 shape. Use Atomic Conditional Update with pool size 50 for the throughput-ceiling comparison, and keep pool size 10 as the conservative DB reference. Redis comparisons should note that Pessimistic Lock is correct but lock-wait-limited, and that `lock_timeout` did not produce controlled failures in the current evidence.
