# Phase 3 DB Strategies Design

## Context

Phase 3 starts from `codex/phase2-grafana-observability`, not from the older `phase/3-db-lock` branch. The older branch is useful only as reference material because it uses the previous `stock`/`overselling` language and predates the current roadmap, `CONTEXT.md`, ADR, and evidence layout.

The current domain model uses:

- **Remaining Seats** in domain language, `remainingSeats` in Java, and `remaining_seats` in schema.
- **Seat Count Inconsistency** for `reservation_count + remaining_seats != initial_seat_count`.
- **Overbooking** for successful Reservation count exceeding the Initial Seat Count.
- **Reservation** only for successful confirmed records.

## Goal

Implement and compare PostgreSQL-based Remaining Seats concurrency strategies without changing the Phase 2 no-lock baseline semantics.

Phase 3 should answer:

- Which DB strategy preserves the counted-seat invariant under concurrent Reservation Requests?
- What throughput and latency cost does each strategy introduce compared with Phase 2?
- How do retry, sold-out rejection, and lock wait differ by strategy?

## Scope

### Keep

- Keep the existing no-lock baseline endpoint as `/api/reservations`, but do not use it as a Phase 3 measurement target.
- Keep the current docs/evidence layout under `docs/phases/03-db-strategies` and `docs/evidence/03-db-strategies`.
- Keep the counted-seat model from ADR 0001.
- Keep `/api/test/reset` and `/api/test/consistency` as fixed Concert 1 / 100-seat helpers for Phase 3. Strategy runs are sequential, so extra query parameters are not needed.

### Add

- `/api/reservations/pessimistic`
- `/api/reservations/optimistic`
- `/api/reservations/atomic`

### Exclude

- Unique Constraint based duplicate Reservation prevention.
- Same-User duplicate request handling.
- Idempotency keys.
- Redis distributed locks, Redis Lua, and external API delay experiments.

These excluded topics belong in later idempotency or Redis phases, not in the Phase 3 seat decrement strategy comparison.

### Do Not Reuse Directly

- Do not merge the older `phase/3-db-lock` branch directly.
- Do not restore `stock` or `overselling` terminology.
- Do not re-measure Phase 2 no-lock baseline on the Phase 3 branch. Phase 2 no-lock evidence remains the baseline reference.

## Strategy Design

### Pessimistic Lock

Load the target Concert with `PESSIMISTIC_WRITE`, validate `remainingSeats > 0`, decrement `remainingSeats`, then insert a Reservation.

Expected behavior:

- Prevents Seat Count Inconsistency.
- Serializes concurrent updates to one Concert row.
- May increase p95/p99 under high contention due to lock waiting.

### Optimistic Lock + Retry

Use standard JPA optimistic locking with `@Version` on `Concert`, and expose it only through `/api/reservations/optimistic` for Phase 3 measurement.

Adding `@Version` may affect the legacy `/api/reservations` no-lock endpoint because all managed `Concert` updates can receive optimistic version checks. That is acceptable in Phase 3 because no-lock is not re-measured on this branch. Phase 2 no-lock evidence remains the comparison baseline.

Expected behavior:

- Prevents Seat Count Inconsistency when retries succeed.
- Converts concurrent conflicts into retries or retry-exhausted failures.
- Needs explicit retry metrics.

### Atomic Conditional Update

Use a single SQL update:

```sql
UPDATE concert
SET remaining_seats = remaining_seats - 1
WHERE id = :concert_id
  AND remaining_seats > 0
```

Insert the Reservation only when the update count is `1`.

The conditional update is the gate for Reservation creation:

1. Run the conditional update inside a transaction.
2. If the update count is `1`, insert the Reservation in the same transaction.
3. If the update count is `0`, return `sold_out` and do not insert a Reservation.

Expected behavior:

- Prevents Seat Count Inconsistency without loading and locking a managed entity.
- Avoids retry loops for seat decrement.
- Uses update count as the sold-out signal.

## API Results

Use response statuses as Reservation Request results, not as domain Reservations:

- `200 reserved`: Reservation was successfully confirmed.
- `409 sold_out`: no Remaining Seats were available.
- `409 optimistic_lock_exhausted`: optimistic retries were exhausted.
- `408 lock_timeout`: pessimistic lock wait timed out.
- `503 connection_pool_exhausted`: DB connections were exhausted.

## Load Test Design

Phase 3 uses the same baseline load shape as Phase 2 so results remain comparable with the recorded Phase 2 baseline evidence.

Only baseline is required for the first Phase 3 comparison. Spike, ramp-up, and sustained scenarios can be added later if Phase 3 findings need more stress data.

Add three strategy-specific baseline presets:

- `k6/presets/phase3-pessimistic-baseline.json`
- `k6/presets/phase3-optimistic-baseline.json`
- `k6/presets/phase3-atomic-baseline.json`

Each preset should keep the Phase 2 baseline executor, VU, duration, and threshold values. The only differences are:

- `phase`: `phase-03`
- `scenario`: `pessimistic`, `optimistic`, or `atomic`
- `preset`: `baseline`
- `path`: the strategy endpoint path
- `evidenceDir`: the strategy evidence directory

`k6/reservation-test.js` should use `preset.path` when present and fall back to `/api/reservations` for existing Phase 2 presets.

Run the three strategies sequentially, not concurrently:

1. Reset DB state.
2. Run one strategy baseline.
3. Capture k6, SQL, and Grafana evidence.
4. Repeat for the next strategy.

Sequential execution avoids cross-strategy interference through shared DB rows, locks, and connection pools. Results are merged only in `report.md`.

## Grafana Design

Do not add a Phase 3 dashboard initially.

Reuse the existing `concurrency-lab-overview` dashboard with labels:

- `phase=phase-03`
- `scenario=pessimistic|optimistic|atomic`
- `preset=baseline`
- `pool=default`

If a side-by-side strategy dashboard becomes useful later, add it after the first baseline evidence exists. It is not required for the Phase 3 implementation gate.

## Verification

Each strategy needs tests for:

- Successful single Reservation decrements Remaining Seats by one.
- Sold-out request does not create a Reservation.
- Concurrent requests preserve `reservation_count + remaining_seats == initial_seat_count`.
- Successful Reservation count does not exceed Initial Seat Count.

SQL evidence should record, per strategy:

- `reservation_count`
- `remaining_seats`
- `initial_seat_count`
- Seat Count Inconsistency value
- Overbooking value

## Reporting

`docs/phases/03-db-strategies/report.md` should compare strategies with separate columns for:

- RPS
- p95
- p99
- expected failure rate
- Seat Count Inconsistency
- Overbooking
- retry count
- sold-out count
- lock wait signal
- evidence path

## Migration Plan

Start implementation from `codex/phase3-db-strategies`.

Use `phase/3-db-lock` only as reference for:

- Pessimistic lock repository method shape.
- Optimistic retry status handling.
- k6 custom metric ideas.

Do not cherry-pick it wholesale.
