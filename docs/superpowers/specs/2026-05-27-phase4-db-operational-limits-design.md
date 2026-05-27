# Phase 4 DB Operational Limits Design

## Context

Phase 4 starts after Phase 3 selected **Atomic Conditional Update** as the preferred DB strategy for the simple counted-seat Reservation path. Phase 3 also kept **Pessimistic Lock** as the serialized correctness reference and observed materially higher p99 latency for that strategy.

The current domain model remains unchanged:

- **Concert** stores **Remaining Seats** as a count, not individual seat rows.
- **Reservation** means a successful confirmed record only.
- The counted-seat invariant is `reservation_count + remaining_seats == initial_seat_count`.
- **Seat Count Inconsistency** and **Overbooking** must remain `0` after successful Phase 4 runs.

Phase 4 is not a new Reservation strategy phase. It measures how DB-backed strategies behave when operational parameters change.

## Goal

Measure DB operational limits for the Phase 3 DB strategies under the same k6 load shape used in Phase 3.

Phase 4 should answer:

- Does increasing HikariCP pool size keep improving RPS and p95/p99?
- Where does Atomic Conditional Update stop benefiting from more DB connections?
- How does Pessimistic Lock connect lock wait, Hikari pending connections, and p99 latency?
- Can `lock_timeout` convert long lock waits into faster failures without breaking consistency?
- What DB baseline should Phase 5 Redis strategies compare against?

## Scope

### Keep

- Keep the Phase 3 baseline load shape:
  - 100 VUs
  - 10 seconds
  - Concert 1
  - Initial Seat Count 100
  - sold-out-dominant run
- Keep the existing Reservation endpoints:
  - `/api/reservations/atomic`
  - `/api/reservations/pessimistic`
- Keep the existing Makefile command interface.
- Keep Phase 3 commands for Phase 3 reproduction.

### Add

- Server startup parameters:
  - `POOL_SIZE`
  - `LOCK_TIMEOUT`
- Three Phase 4 k6 presets:
  - `phase4-atomic-pool`
  - `phase4-pessimistic-pool`
  - `phase4-pessimistic-timeout`
- k6 `POOL` override so one preset can be reused across pool sizes.
- Generic counted-seat consistency SQL evidence.
- Phase 4 SQL consistency alias.
- Phase 4 runbook, scope, observability, and report templates aligned with this design.

### Exclude

- Deadlock reproduction. In the current Reservation flow, one Reservation touches one Concert. Deadlock reproduction would require a synthetic two-Concert lock order experiment and would not explain the core Reservation strategy behavior.
- `statement_timeout` validation. The current Reservation statements are short; Phase 4 focuses on `lock_timeout`.
- Redis, WireMock, Kafka, Outbox, idempotency keys, and same-User duplicate prevention.

## Parameter Design

### Server Parameters

`make server-start` accepts operational parameters:

```bash
make server-start POOL_SIZE=10
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
```

`POOL_SIZE` maps to:

```text
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE
```

`LOCK_TIMEOUT` accepts numeric milliseconds only. `LOCK_TIMEOUT=500` maps to:

```sql
SET lock_timeout = '500ms'
```

`LOCK_TIMEOUT=0` means PostgreSQL default behavior: no lock wait timeout.

### Pool Sizes

Use these values:

- `2`
- `5`
- `10`
- `20`
- `50`

`10` is the current default Hikari pool size and the Phase 3 baseline reference. This was confirmed through:

```text
hikaricp_connections_max{application="concurrency",pool="HikariPool-1"} 10.0
```

### Lock Timeout Values

Use these values for Pessimistic Lock timeout experiments:

- `200`
- `500`
- `1000`

The unit is milliseconds and is expressed only in Makefile input, not in the command value.

## k6 Preset Design

Use three reusable presets instead of one preset per pool size.

### `phase4-atomic-pool`

- `phase`: `phase-04`
- `evidenceDir`: `04-db-operational-limits/atomic-pool`
- `scenario`: `atomic`
- `preset`: `pool-limit`
- `pool`: `10`
- `path`: `/api/reservations/atomic`

The `pool` field is the default label. The Makefile can override it through `POOL=2`, `POOL=5`, and so on.

### `phase4-pessimistic-pool`

- `phase`: `phase-04`
- `evidenceDir`: `04-db-operational-limits/pessimistic-pool`
- `scenario`: `pessimistic`
- `preset`: `pool-lock-wait`
- `pool`: `10`
- `path`: `/api/reservations/pessimistic`

### `phase4-pessimistic-timeout`

- `phase`: `phase-04`
- `evidenceDir`: `04-db-operational-limits/pessimistic-timeout`
- `scenario`: `pessimistic`
- `preset`: `lock-timeout`
- `pool`: `10`
- `path`: `/api/reservations/pessimistic`

## Execution Design

### Atomic Pool Matrix

For each pool size:

1. Start the server with `make server-start POOL_SIZE=<pool>`.
2. Confirm `hikaricp_connections_max` through actuator Prometheus.
3. Run k6:

```bash
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-10 PRESET=phase4-atomic-pool POOL=10 CONDITION=pool-10
```

4. Save consistency evidence:

```bash
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

### Pessimistic Pool Matrix

For each pool size:

1. Start the server with `make server-start POOL_SIZE=<pool>`.
2. Confirm `hikaricp_connections_max`.
3. Run k6:

```bash
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-10 PRESET=phase4-pessimistic-pool POOL=10 CONDITION=pool-10
```

4. Save consistency evidence:

```bash
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-10
```

5. Capture `pg_locks` and `pg_stat_activity` snapshots for representative lock-wait cases, especially `pool-10` and `pool-50`.

### Pessimistic Timeout Matrix

Use `POOL_SIZE=10` as the representative pool because it is the current default and Phase 3 reference point.

For each timeout value:

1. Restart the server:

```bash
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
```

2. Run k6:

```bash
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-500 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-500
```

3. Save consistency evidence:

```bash
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-500
```

4. Record HTTP response distribution, especially `reserved`, `sold_out`, and `lock_timeout`.

## Evidence Design

Evidence is grouped by experiment type and parameter value:

```text
docs/evidence/04-db-operational-limits/
├── atomic-pool/
│   ├── pool-2/
│   ├── pool-5/
│   ├── pool-10/
│   ├── pool-20/
│   └── pool-50/
├── pessimistic-pool/
│   ├── pool-2/
│   ├── pool-5/
│   ├── pool-10/
│   ├── pool-20/
│   └── pool-50/
└── pessimistic-timeout/
    ├── timeout-200/
    ├── timeout-500/
    └── timeout-1000/
```

Each completed condition should include:

- k6 summary JSON
- k6 log
- Grafana run window JSON
- consistency SQL result

Representative conditions should also include:

- Grafana stitched dashboard
- `pg_locks` snapshot
- `pg_stat_activity` snapshot
- application log excerpt when timeout behavior needs evidence

## Grafana Capture Policy

Do not capture Grafana for every condition.

Capture these representative conditions:

- Atomic pool: `pool-2`, `pool-10`, `pool-50`
- Pessimistic pool: `pool-2`, `pool-10`, `pool-50`
- Pessimistic timeout: `timeout-500`

This keeps evidence useful without producing redundant screenshots for every matrix point.

## Observability

Use these signals:

- k6:
  - RPS
  - p95
  - p99
  - HTTP response distribution
- Spring / HikariCP:
  - `hikaricp_connections_max`
  - `hikaricp_connections_active`
  - `hikaricp_connections_pending`
- PostgreSQL:
  - `pg_locks`
  - `pg_stat_activity`
- Domain consistency:
  - `reservation_count`
  - `remaining_seats`
  - `seat_count_inconsistency`
  - `overbooked`

## Reporting

`docs/phases/04-db-operational-limits/report.md` should record:

- Atomic pool matrix results
- Pessimistic pool matrix results
- Pessimistic timeout matrix results
- Which pool size is a reasonable DB default for this workload
- Whether Pessimistic Lock p99 is explained by lock wait
- Whether `lock_timeout` improves tail latency by converting waits into controlled failures
- Whether all measured conditions preserve the counted-seat invariant

## Completion Criteria

Phase 4 is complete when:

- Atomic pool matrix k6 evidence exists for `2`, `5`, `10`, `20`, `50`.
- Pessimistic pool matrix k6 evidence exists for `2`, `5`, `10`, `20`, `50`.
- Pessimistic timeout k6 evidence exists for `200`, `500`, `1000`.
- Consistency SQL evidence exists for each condition.
- Representative Grafana captures exist for the selected capture policy.
- Lock wait snapshots exist for representative Pessimistic Lock runs.
- `report.md` explains DB operational limits and the Phase 5 Redis comparison baseline.
