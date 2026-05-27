# Report

## Summary

Phase 3 compared three DB-backed Reservation strategies under the same baseline load shape: 100 VUs for 10 seconds against Concert 1 with 100 initial seats. All three strategies preserved the counted-seat invariant in the k6 teardown consistency snapshot: 100 successful Reservations, 0 Remaining Seats, 0 Seat Count Inconsistency, and no Overbooking.

This baseline is a high-contention, sold-out-dominant run. After the first 100 successful Reservations, remaining requests are expected 409 responses and are not counted as k6 HTTP failures.

## Strategy Comparison

| Strategy | RPS | p95 | p99 | Expected Failure Rate | Seat Count Inconsistency | Overbooking | Evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| Pessimistic Lock | 712.70 | 219.96 ms | 1108.10 ms | 0.00% | 0 | 0 | `docs/evidence/03-db-strategies/pessimistic-lock/k6/phase3-pessimistic-baseline-prometheus-20260527-091241-summary.json`; `docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt`; `docs/evidence/03-db-strategies/pessimistic-lock/grafana/stitched-dashboard.png` |
| Optimistic Lock + Retry | 1259.05 | 148.22 ms | 1055.70 ms | 0.00% | 0 | 0 | `docs/evidence/03-db-strategies/optimistic-lock/k6/phase3-optimistic-baseline-prometheus-20260527-091421-summary.json`; `docs/evidence/03-db-strategies/optimistic-lock/sql/baseline-consistency.txt`; `docs/evidence/03-db-strategies/optimistic-lock/grafana/stitched-dashboard.png` |
| Atomic Conditional Update | 1467.97 | 132.31 ms | 354.40 ms | 0.00% | 0 | 0 | `docs/evidence/03-db-strategies/atomic-update/k6/phase3-atomic-baseline-prometheus-20260527-091517-summary.json`; `docs/evidence/03-db-strategies/atomic-update/sql/baseline-consistency.txt`; `docs/evidence/03-db-strategies/atomic-update/grafana/stitched-dashboard.png` |

## Strategy Metrics

| Strategy | Retry Count | Rejected Request Count | Lock Wait Signal |
|---|---:|---:|---|
| Pessimistic Lock | N/A | 7129 | `pg_locks_count` max 9 |
| Optimistic Lock + Retry | 409 | 12721 | N/A |
| Atomic Conditional Update | N/A | 14816 | N/A |

Rejected Request Count is inferred as `iterations - concert_reservation_count` from k6 summary metrics. For pessimistic and atomic strategies this maps to expected sold-out rejection. For optimistic strategy, the 409 responses can include both sold-out rejection and optimistic retry exhaustion because the current k6 script does not classify response bodies.

## Evidence Notes

- k6 summary JSON provides RPS, p95, HTTP failure rate, iterations, and teardown consistency metrics.
- p99 comes from Prometheus `k6_http_req_duration_p99` over each strategy's run-window JSON.
- Grafana stitched dashboards were captured for all three strategies under their strategy-specific evidence directories.
- SQL `baseline-consistency.txt` files were captured immediately after each strategy run and confirm the same final consistency state as the k6 teardown snapshots.

## Findings

Atomic Conditional Update is the best default DB strategy for this counted-seat decrement model. It preserves correctness with no retry loop and has the highest RPS and lowest observed p99 among the Phase 3 runs. Optimistic Lock + Retry is correct but required 409 retries and has response classification ambiguity for 409 responses. Pessimistic Lock is correct but materially slower and showed high tail latency.

All strategies reached exactly 100 successful Reservations and 0 Remaining Seats. None produced Seat Count Inconsistency or Overbooking.

## Decision

Use Atomic Conditional Update as the preferred DB strategy for the simple counted-seat Reservation path. Keep Optimistic Lock + Retry as a viable strategy when business logic must operate on the loaded entity, and keep Pessimistic Lock as the serialized correctness reference rather than the default high-throughput path.

## Next Phase Input

Phase 4 should focus on DB operational limits around connection pool pressure, lock activity, retry exhaustion, and clearer expected-rejection observability. The next measurement pass should add response body classification in k6 so `sold_out` and `optimistic_lock_exhausted` can be counted separately.
