# Reservation Strategy Refactor Design

## Context

This integration work starts from `codex/phase4-db-operational-limits`, not from the Phase 5 branch.

Phase 3 and Phase 4 are the most reliable completed states for this portfolio project. Phase 5 Redis work exists, but it changes application code, infrastructure, k6 presets, and observability together. Using Phase 5 as the base would make the integration branch inherit unfinished Redis-specific coupling.

Before this refactor, Phase 3 hardened documentation and evidence are recovered from `codex/phase3-db-strategies` into the integration branch:

- `docs/phases/03-db-strategies/`
- `docs/evidence/03-db-strategies/`
- `docs/roadmap/03-db-strategies.md`
- `docs/superpowers/specs/2026-05-30-phase3-evidence-hardening-design.md`

The final `main` should represent a unified experiment app through Phase 4. Completed phase conclusions are preserved in `docs/phases/` and `docs/evidence/`, not by keeping long-lived divergent application branches.

## Problem

The current application code uses `ReservationService` as the central place for every reservation strategy:

- no-lock baseline
- pessimistic lock
- optimistic lock with retry
- atomic conditional update

`ReservationController` also exposes one method per strategy. As new phases add Redis, idempotency, or payment-adjacent behavior, the same service and controller files become merge hot spots.

This is already visible in the branch history. Phase-specific work changes the same application files, while docs and evidence can safely coexist by phase directory.

## Goal

Refactor the Phase 4 application into a strategy-oriented structure so new experiment strategies are added mostly as new files.

The target state should:

- keep Phase 2, 3, and 4 behavior reproducible;
- keep existing endpoint compatibility for current k6 presets and reports;
- add a generic strategy dispatch path for future phases;
- reduce future merge conflicts in `ReservationService`, `ReservationController`, and `ConcertRepository`;
- make Phase 5 Redis and Phase 6 Idempotency additions fit the same structure.

## Non-Goals

- Do not re-run Phase 2, 3, or 4 experiments as part of the refactor.
- Do not port Phase 5 Redis implementation in this integration branch.
- Do not implement Phase 6 Idempotency in this integration branch.
- Do not preserve each phase as a separate historical application state.
- Do not introduce a full production-grade clean architecture layer.

## Branch Policy

The branch flow is:

```text
codex/phase4-db-operational-limits
  -> codex/integrate-strategy-refactor
  -> main
```

After this integration reaches `main`, future work should branch from latest `main`:

```text
main -> codex/phase5-redis-strategies-v2
main -> codex/phase6-idempotency
main -> codex/phase7-wiremock-payment-adjacent
```

Existing Phase 5 work should be treated as a reference branch. Its useful Redis code, docs, and evidence can be selectively ported after the strategy refactor lands.

## Architecture

### Strategy Contract

Create a small strategy interface:

```java
public interface ReservationStrategy {
    String name();

    void reserve(ReservationCommand command);
}
```

`ReservationCommand` carries the common reservation input:

```java
public record ReservationCommand(Long concertId, Long userId) {
}
```

Strategy names should match experiment labels and endpoint path segments:

- `no-lock`
- `pessimistic`
- `optimistic`
- `atomic`

Phase 5 can later add:

- `redisson`
- `redis-lua`

Phase 6 can later add wrapper-style strategies or use cases such as:

- `idempotent-atomic`

### Strategy Implementations

Move the current `ReservationService` methods into separate strategy classes:

```text
service/strategy/
├── NoLockReservationStrategy.java
├── PessimisticLockReservationStrategy.java
├── OptimisticLockReservationStrategy.java
└── AtomicUpdateReservationStrategy.java
```

Each class owns its transaction boundary and dependencies. Adding a future strategy should not require editing existing strategy classes.

### Registry

Create `ReservationStrategyRegistry` that receives `List<ReservationStrategy>` from Spring and builds a name-to-strategy map.

The registry should fail fast on duplicate strategy names and throw a clear exception for unknown names.

This avoids a central `switch`, `if/else`, or enum that must be edited every phase.

### Use Case

Create `ReservationUseCase` as the stable application entry point:

```text
ReservationUseCase
  -> ReservationStrategyRegistry
  -> selected ReservationStrategy
```

It should expose:

```java
void reserve(String strategyName, ReservationCommand command);
```

This replaces `ReservationService` as the controller dependency. The old `ReservationService` should be removed or reduced to a compatibility facade only if tests require a temporary migration step.

### Controller

Keep existing endpoints for compatibility:

```text
POST /api/reservations
POST /api/reservations/pessimistic
POST /api/reservations/optimistic
POST /api/reservations/atomic
```

Add one generic endpoint:

```text
POST /api/reservations/{strategy}
```

Compatibility mapping:

```text
/api/reservations             -> no-lock
/api/reservations/pessimistic -> pessimistic
/api/reservations/optimistic  -> optimistic
/api/reservations/atomic      -> atomic
```

The controller should centralize response mapping so new endpoint methods do not duplicate exception handling.

### Repository Boundary

Do not over-abstract simple JPA operations. Keep `ConcertRepository` and `ReservationRepository` as Spring Data repositories.

However, atomic update should move behind a small writer component:

```text
DbReservationWriter
  - reserveWithAtomicUpdate(concertId, userId)
```

This is useful because Phase 5 Redis Lua and Phase 6 idempotent atomic flows need to reuse the atomic DB write without calling a whole strategy through HTTP/controller concerns.

Pessimistic lock can remain in `ConcertRepository` for now. If future phases create more DB-specific query methods, split them later into focused components.

## Phase 6 Fit

Phase 6 will compare two distinct idempotency mechanisms:

1. `UNIQUE(concert_id, user_id)` as a domain constraint.
2. `idempotency_key` table as request retry tracking.

The refactor should prepare for this by separating reservation strategy execution from request-level wrappers.

Phase 6 should not modify the existing atomic strategy to become idempotent. Instead, it should add a wrapper/use case around an existing strategy:

```text
IdempotentReservationUseCase
  -> IdempotencyStore
  -> ReservationUseCase(strategy = atomic)
```

This keeps the distinction clear:

- `UNIQUE(concert_id, user_id)` prevents duplicate successful Reservations for the same User and Concert.
- `Idempotency-Key` returns the same result for retried equivalent requests.

## Error Mapping

Preserve the current response contract:

```text
success                       -> 200 {"status":"reserved"}
sold out                      -> 409 {"status":"sold_out"}
optimistic retry exhausted    -> 409 {"status":"optimistic_lock_exhausted"}
pessimistic lock timeout      -> 408 {"status":"lock_timeout"}
unknown strategy              -> 404 {"status":"unknown_strategy"}
```

The generic endpoint should return the same body/status pairs as existing strategy-specific endpoints.

## Testing

Refactor tests without changing the behavioral expectations.

Required verification:

- existing unit/integration tests pass;
- no-lock baseline test still demonstrates unsafe behavior where applicable;
- pessimistic, optimistic, and atomic concurrency tests still preserve the counted-seat invariant;
- controller tests cover existing compatibility endpoints;
- controller tests cover the generic strategy endpoint;
- unknown strategy returns the documented error response.

The main verification command is:

```bash
cd concurrency && ./gradlew test
```

If running on Windows Git Bash remains necessary, use the existing project convention for Gradle execution.

## Migration Steps

1. Recover Phase 3 hardened docs/evidence into the Phase 4-based integration branch.
2. Add `ReservationCommand`, `ReservationStrategy`, `ReservationStrategyRegistry`, and `ReservationUseCase`.
3. Move each current strategy method into its own strategy class.
4. Extract atomic DB write into `DbReservationWriter`.
5. Update `ReservationController` to use the use case and central response handling.
6. Update tests from direct `ReservationService` calls to strategy/use case calls.
7. Run the test suite.
8. Merge the integration branch into `main`.
9. Start Phase 5 v2 from latest `main` and port Redis work selectively.

## Completion Criteria

- Phase 3 latest docs/evidence are present on the integration branch.
- Phase 4 docs/evidence remain intact.
- `ReservationService` no longer contains every strategy method.
- Adding a new strategy does not require editing a central strategy enum or switch.
- Existing Phase 2-4 endpoints remain compatible.
- `/api/reservations/{strategy}` works for current strategies.
- Tests pass.
