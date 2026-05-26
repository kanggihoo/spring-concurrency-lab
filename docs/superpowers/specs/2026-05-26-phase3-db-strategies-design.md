# Phase 3 DB Strategies Design

## Context

Phase 3 starts from `codex/phase2-grafana-observability`, not from the older `phase/3-db-lock` branch. The older branch is useful only as reference material because it uses the previous `stock`/`overselling` language and predates the current roadmap, `CONTEXT.md`, ADR, and evidence layout.

The current domain model uses:

- **Remaining Seats** in domain language, `remainingSeats` in Java, and `remaining_seats` in schema.
- **Seat Count Inconsistency** for `reservation_count + remaining_seats != initial_seat_count`.
- **Overbooking** for successful Reservation count exceeding the Initial Seat Count.
- **Reservation** only for successful confirmed records.
- At most one successful **Reservation** per `(Concert, User)`.

## Goal

Implement and compare PostgreSQL-based concurrency strategies without changing the Phase 2 no-lock baseline semantics.

Phase 3 should answer:

- Which DB strategy preserves the counted-seat invariant under concurrent Reservation Requests?
- What throughput and latency cost does each strategy introduce compared with Phase 2?
- How do retry, sold-out rejection, lock wait, and duplicate request rejection differ by strategy?

## Scope

### Keep

- Keep the existing no-lock baseline endpoint as `/api/reservations`.
- Keep the current docs/evidence layout under `docs/phases/03-db-strategies` and `docs/evidence/03-db-strategies`.
- Keep the counted-seat model from ADR 0001.

### Add

- `/api/reservations/pessimistic`
- `/api/reservations/optimistic`
- `/api/reservations/atomic`
- DB-level duplicate successful Reservation prevention using a unique constraint on `(concert_id, user_id)`.

### Do Not Reuse Directly

- Do not merge the older `phase/3-db-lock` branch directly.
- Do not restore `stock` or `overselling` terminology.
- Do not add `@Version` in a way that changes the behavior of the Phase 2 no-lock baseline endpoint.

## Strategy Design

### Pessimistic Lock

Load the target Concert with `PESSIMISTIC_WRITE`, validate `remainingSeats > 0`, decrement `remainingSeats`, then insert a Reservation.

Expected behavior:

- Prevents Seat Count Inconsistency.
- Serializes concurrent updates to one Concert row.
- May increase p95/p99 under high contention due to lock waiting.

### Optimistic Lock + Retry

Use optimistic version checking only for the optimistic strategy path. A version field can exist on `Concert`, but the no-lock baseline must not be measured through a path affected by optimistic retry semantics.

Expected behavior:

- Prevents Seat Count Inconsistency when retries succeed.
- Converts concurrent conflicts into retries or retry-exhausted failures.
- Needs explicit retry metrics.

Open implementation detail:

- If adding `@Version` to `Concert` would make `/api/reservations` no longer represent Phase 2 no-lock behavior, use a strategy-specific repository update or separate command path so Phase 2 remains comparable.

### Atomic Conditional Update

Use a single SQL update:

```sql
UPDATE concert
SET remaining_seats = remaining_seats - 1
WHERE id = :concert_id
  AND remaining_seats > 0
```

Insert the Reservation only when the update count is `1`.

Expected behavior:

- Prevents Seat Count Inconsistency without loading and locking a managed entity.
- Avoids retry loops for seat decrement.
- Uses update count as the sold-out signal.

### Unique Constraint

Add a unique constraint or unique index for `(concert_id, user_id)` on `reservation`.

This is not a seat decrement strategy. It protects the rule that one User can have at most one successful Reservation for a Concert.

Expected behavior:

- Duplicate Reservation Requests for the same `(Concert, User)` should not create multiple successful Reservations.
- Duplicate rejection must not leave `remainingSeats` decremented without a corresponding successful Reservation.

## API Results

Use response statuses as Reservation Request results, not as domain Reservations:

- `200 reserved`: Reservation was successfully confirmed.
- `409 sold_out`: no Remaining Seats were available.
- `409 duplicate_reservation`: the User already has a successful Reservation for the Concert.
- `409 optimistic_lock_exhausted`: optimistic retries were exhausted.
- `408 lock_timeout`: pessimistic lock wait timed out.
- `503 connection_pool_exhausted`: DB connections were exhausted.

## Verification

Each strategy needs tests for:

- Successful single Reservation decrements Remaining Seats by one.
- Sold-out request does not create a Reservation.
- Concurrent requests preserve `reservation_count + remaining_seats == initial_seat_count`.
- Successful Reservation count does not exceed Initial Seat Count.
- Duplicate `(Concert, User)` requests create at most one successful Reservation.

SQL evidence should record, per strategy:

- `reservation_count`
- `remaining_seats`
- `initial_seat_count`
- Seat Count Inconsistency value
- Overbooking value
- duplicate successful Reservation count

## Reporting

`docs/phases/03-db-strategies/report.md` should compare strategies with separate columns for:

- RPS
- p95
- p99
- error or expected-failure rate
- Seat Count Inconsistency
- Overbooking
- duplicate successful Reservation count
- retry count
- sold-out count
- duplicate rejection count
- evidence path

## Migration Plan

Start implementation from `codex/phase3-db-strategies`.

Use `phase/3-db-lock` only as reference for:

- Pessimistic lock repository method shape.
- Optimistic retry status handling.
- k6 custom metric ideas.

Do not cherry-pick it wholesale.
