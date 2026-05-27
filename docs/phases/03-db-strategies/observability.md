# Observability

Phase 3 reuses the shared Grafana overview dashboard and filters by k6 labels.

## Label sets

- `phase="phase-03", scenario="pessimistic", preset="baseline", pool="default"`
- `phase="phase-03", scenario="optimistic", preset="baseline", pool="default"`
- `phase="phase-03", scenario="atomic", preset="baseline", pool="default"`

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| k6 | `k6_http_reqs_total` | request throughput |
| k6 | `k6_http_req_duration_p95` | p95 latency from Prometheus remote write |
| k6 | `k6_http_req_duration_p99` | p99 latency from Prometheus remote write |
| k6 | `k6_http_req_failed_rate` | unexpected HTTP failure rate |
| k6 | `k6_concert_reservation_count` | final successful Reservation count from teardown snapshot |
| k6 | `k6_concert_remaining_seats` | final Remaining Seats from teardown snapshot |
| k6 | `k6_concert_seat_count_inconsistency` | final Seat Count Inconsistency from teardown snapshot |
| k6 | `k6_concert_overbooked` | final Overbooking flag from teardown snapshot |
| App | `reservation_optimistic_retry_total` | optimistic retry attempts |
| Spring | `hikaricp_connections_active`, `hikaricp_connections_pending` | connection pool pressure |
| PostgreSQL | `pg_locks_count` | lock activity signal |

## Evidence Paths

Each strategy stores evidence under its own directory:

- `docs/evidence/03-db-strategies/pessimistic-lock/`
- `docs/evidence/03-db-strategies/optimistic-lock/`
- `docs/evidence/03-db-strategies/atomic-update/`

Required evidence types:

- k6 summary JSON: `k6/*-summary.json`
- k6 terminal log: `logs/*.log`
- Grafana run-window JSON: `grafana/run-window-*.json`
- Grafana stitched dashboard: `grafana/stitched-dashboard.png`
- SQL consistency snapshot, when captured immediately after the matching strategy run: `sql/baseline-consistency.txt`

## SQL Consistency

The SQL check verifies the counted-seat invariant for Concert 1:

- `reservation_count + remaining_seats == initial_seat_count`
- `reservation_count <= initial_seat_count`

Use:

```bash
make phase3-sql-consistency STRATEGY=pessimistic-lock
make phase3-sql-consistency STRATEGY=optimistic-lock
make phase3-sql-consistency STRATEGY=atomic-update
```
