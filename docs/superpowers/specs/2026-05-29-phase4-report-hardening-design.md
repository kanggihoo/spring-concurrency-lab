# Phase 4 Report Hardening Design

## Context

Phase 4 already has a design, implementation plan, k6 evidence, SQL consistency evidence, Grafana captures, and `report.md`.

The original Phase 4 goal remains valid: measure how DB-backed Reservation strategies behave when operational parameters change. This hardening pass does not redesign Phase 4 and does not introduce a new Reservation strategy. It closes evidence traceability gaps so the Phase 4 report is defensible as a backend portfolio artifact.

Current weak points:

- k6 summary JSON contains p95 but not p99, so `report.md` mixed k6 summary p95 with Prometheus p99.
- `Hikari Pending` values appear in the report, but the exact Prometheus query results are not stored as text/JSON evidence.
- Timeout response distribution is inferred from `iterations - reserved`, because k6 does not emit response classification counters.
- `pg_locks` and `pg_stat_activity` evidence was collected with inline SQL commands in the runbook.
- Phase docs still contain planned/unchecked status markers even though evidence exists.

## Goal

Make Phase 4 `report.md` independently defensible by ensuring every reported number can be traced to a concrete evidence file.

The hardened Phase 4 report should answer:

- Which k6 summary fields produced RPS, p95, p99, iterations, and failure rate?
- Which response counts were `reserved`, `sold_out`, `lock_timeout`, or unexpected?
- Which run-window Hikari metrics support the pool pressure interpretation?
- Which PostgreSQL lock snapshots support the Pessimistic Lock row serialization interpretation?
- Which evidence shows that every condition preserves the counted-seat invariant?

## Non-Goals

- Do not rewrite the original Phase 4 design from scratch.
- Do not add a new production Reservation strategy.
- Do not add `EXPLAIN ANALYZE` evidence for this pass. Phase 4 is about pool pressure and row lock wait, not query plan tuning.
- Do not make Grafana screenshots the source of truth for table values. Screenshots remain visual evidence only.
- Do not require a new Makefile target for PostgreSQL lock snapshots. SQL files plus explicit runbook commands are sufficient.

## Design

### k6 Summary as Latency Source of Truth

Add `summaryTrendStats` to `k6/reservation-test.js` so `--summary-export` includes p99.

Required trend stats:

```javascript
summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"]
```

After this change, `report.md` should use k6 summary JSON for:

- RPS: `metrics.http_reqs.rate`
- p95: `metrics.http_req_duration["p(95)"]`
- p99: `metrics.http_req_duration["p(99)"]`
- iterations: `metrics.iterations.count`
- failure rate: `metrics.http_req_failed.value`

Prometheus should no longer be used as the latency source for p99 in the Phase 4 table.

### Preset-Driven Expected Statuses

Change k6 status expectations to come from each preset.

Atomic pool and Pessimistic pool presets:

```json
"expectedStatuses": [200, 409]
```

Pessimistic timeout preset:

```json
"expectedStatuses": [200, 409, 408]
```

The timeout preset treats HTTP 408 as an expected controlled failure, not as a test failure. The normal pool experiments should still fail if 408 appears unexpectedly.

### Response Classification Counters

Add k6 custom counters:

- `reservation_reserved`
- `reservation_sold_out`
- `reservation_lock_timeout`
- `reservation_unexpected_status`

Classification rule:

- `200` -> `reservation_reserved`
- `409` -> `reservation_sold_out`
- `408` -> `reservation_lock_timeout`
- any other status -> `reservation_unexpected_status`

`report.md` should use these counters for timeout response distribution instead of `iterations - reserved`.

### Hikari Prometheus Evidence

Grafana already visualizes Hikari metrics, but reported table values should also be stored as machine-readable evidence.

For each run condition, store a small summary file under:

```text
docs/evidence/04-db-operational-limits/<experiment>/<condition>/prometheus/hikari-summary.json
```

Required values are run-window aggregates, not arbitrary instant values:

- `hikaricp_connections_max`
- `max_over_time(hikaricp_connections_active[run_window])`
- `max_over_time(hikaricp_connections_pending[run_window])`

The exact query string, run-window start/end, and numeric value should be stored.

Grafana screenshots remain useful visual evidence, but `hikari-summary.json` is the source for report table values such as `Hikari Pending`.

### PostgreSQL Lock Snapshot SQL Files

Move inline PostgreSQL lock queries into reusable SQL files.

Create:

```text
scripts/sql/pg-lock-wait-snapshot.sql
scripts/sql/pg-lock-summary.sql
```

`pg-lock-wait-snapshot.sql`:

```sql
SELECT
  a.pid,
  a.state,
  a.wait_event_type,
  a.wait_event,
  now() - a.query_start AS query_age,
  now() - a.xact_start AS xact_age,
  pg_blocking_pids(a.pid) AS blocking_pids,
  a.query
FROM pg_stat_activity a
WHERE a.datname = 'reservation'
  AND a.wait_event_type IS NOT NULL
ORDER BY query_age DESC;
```

`pg-lock-summary.sql`:

```sql
SELECT
  locktype,
  relation::regclass AS relation,
  mode,
  granted,
  count(*) AS count
FROM pg_locks
WHERE relation IS NOT NULL
GROUP BY locktype, relation, mode, granted
ORDER BY granted, count DESC;
```

Run these during Pessimistic pool lock-heavy runs, especially `pool-10` and `pool-50`.

Example command shape:

```powershell
docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-wait-snapshot.sql `
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-wait-snapshot.txt
```

No Makefile target is required unless this becomes repeated enough to justify one.

### Timeout Interpretation

The timeout experiment has two valid outcomes:

- If `reservation_lock_timeout > 0`, report that `lock_timeout` produced controlled failures under the measured workload.
- If `reservation_lock_timeout = 0`, report that the current sold-out-dominant workload did not create long enough lock waits to trigger timeout.

Do not claim that `lock_timeout` is effective unless 408 responses are actually observed.

If a future synthetic timeout-stress experiment is added, it must be labeled separately from the Phase 3/4 baseline workload.

## Evidence Layout

Each condition should contain:

```text
docs/evidence/04-db-operational-limits/<experiment>/<condition>/
├── k6/
│   └── *-summary.json
├── logs/
│   └── *.log
├── sql/
│   ├── consistency.txt
│   ├── pg-lock-wait-snapshot.txt        # pessimistic representative runs only
│   └── pg-lock-summary.txt              # pessimistic representative runs only
├── prometheus/
│   └── hikari-summary.json
└── grafana/
    └── stitched-dashboard.png           # representative runs only
```

Representative Grafana captures remain:

- Atomic pool: `pool-2`, `pool-10`, `pool-50`
- Pessimistic pool: `pool-2`, `pool-10`, `pool-50`
- Pessimistic timeout: `timeout-500`

## Rerun Strategy

Recommended rerun scope:

- Atomic pool: `2`, `5`, `10`, `20`, `50`
- Pessimistic pool: `2`, `5`, `10`, `20`, `50`
- Pessimistic timeout: `200`, `500`, `1000`

Reason:

- k6 summary format changes when p99 and response counters are added.
- Reusing old and new k6 summaries in the same report would make the table harder to defend.

During Pessimistic pool `pool-10` and `pool-50`, capture PostgreSQL lock snapshots while k6 is still running.

## Report Update Rules

Update `docs/phases/04-db-operational-limits/report.md` with these source rules:

- RPS, p95, p99, iterations, failure rate: k6 summary JSON.
- Reserved, sold-out, lock-timeout, unexpected responses: k6 custom counters.
- Hikari Pending/Active/Max: `prometheus/hikari-summary.json`.
- Seat Count Inconsistency and Overbooking: `sql/consistency.txt`.
- Pessimistic row lock evidence: `sql/pg-lock-wait-snapshot.txt` and `sql/pg-lock-summary.txt`.

Remove the previous caveat that p95 and p99 come from different sources after the rerun.

Replace the timeout note that sold-out is calculated as `iterations - reserved` with response counter evidence.

Update phase docs:

- Change `README.md` status from `Planned` to the accurate hardened status.
- Mark completion gates as done or explicitly partial.
- State any remaining timeout limitation directly.

## Acceptance Criteria

Phase 4 hardening is complete when:

- k6 summary JSON includes `p(99)` for every Phase 4 rerun.
- Every Phase 4 summary includes response classification counters.
- Atomic pool and Pessimistic pool tables use k6 summary p95 and p99 from the same source.
- Hikari report values are backed by `prometheus/hikari-summary.json`.
- Pessimistic representative lock evidence uses SQL files from `scripts/sql/`.
- Timeout response distribution is based on k6 counters, not inferred arithmetic.
- `report.md` links to the strengthened evidence and no longer contains mixed-source latency caveats.
- Phase 4 README/scope status reflects the actual evidence state.
