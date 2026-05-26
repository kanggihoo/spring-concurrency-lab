# Phase 3 DB Strategies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and measure three PostgreSQL Remaining Seats concurrency strategies: Pessimistic Lock, Optimistic Lock + Retry, and Atomic Conditional Update.

**Architecture:** Keep the Phase 2 no-lock endpoint as legacy code and do not use it for Phase 3 measurement. Add strategy-specific service methods and endpoints, use JPA `@Version` for the optimistic strategy, use a repository-level conditional update for atomic decrement, and keep k6/Grafana evidence split by strategy directory.

**Tech Stack:** Spring Boot 4, Java 21, Spring Data JPA, PostgreSQL, Testcontainers, Gradle, k6, Prometheus, Grafana.

---

## Source Spec

- `docs/superpowers/specs/2026-05-26-phase3-db-strategies-design.md`

## Execution Order

Run the plan files in numeric order:

1. [000-foundation-domain-and-repositories.md](./000-foundation-domain-and-repositories.md)
2. [001-pessimistic-lock-strategy.md](./001-pessimistic-lock-strategy.md)
3. [002-optimistic-lock-strategy.md](./002-optimistic-lock-strategy.md)
4. [003-atomic-conditional-update-strategy.md](./003-atomic-conditional-update-strategy.md)
5. [004-k6-phase3-presets-and-evidence.md](./004-k6-phase3-presets-and-evidence.md)
6. [005-final-verification-and-reporting.md](./005-final-verification-and-reporting.md)

## File Map

- Modify `concurrency/src/main/java/com/example/concurrency/domain/Concert.java`: add JPA `@Version`, sold-out guarded decrement, and keep `remainingSeats` naming.
- Modify `postgres/init/02_schema.sql`: add `version BIGINT NOT NULL DEFAULT 0`.
- Modify `concurrency/src/main/java/com/example/concurrency/repository/ConcertRepository.java`: add pessimistic lock lookup and atomic conditional update.
- Create `concurrency/src/main/java/com/example/concurrency/domain/SoldOutException.java`: domain-specific failure for no Remaining Seats.
- Create `concurrency/src/main/java/com/example/concurrency/service/OptimisticLockRetryExhaustedException.java`: API-facing failure after retry exhaustion.
- Modify `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`: add three strategy methods and keep no-lock legacy method.
- Modify `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`: add strategy endpoints and status mapping.
- Create `concurrency/src/test/java/com/example/concurrency/DbStrategiesConcurrencyTest.java`: Testcontainers strategy correctness tests.
- Modify `k6/reservation-test.js`: read optional `preset.path`.
- Create `k6/presets/phase3-pessimistic-baseline.json`: Phase 3 baseline preset for pessimistic lock.
- Create `k6/presets/phase3-optimistic-baseline.json`: Phase 3 baseline preset for optimistic lock.
- Create `k6/presets/phase3-atomic-baseline.json`: Phase 3 baseline preset for atomic update.
- Create `scripts/sql/phase3-consistency-check.sql`: SQL evidence query for Phase 3.
- Modify `docs/phases/03-db-strategies/report.md`: fill measured results after execution.

## Commit Strategy

Each numbered plan file ends with a commit step. Keep commits scoped:

- foundation and repository contract
- pessimistic lock strategy
- optimistic lock strategy
- atomic conditional update strategy
- k6 Phase 3 presets and evidence query
- final verification and report updates

Do not combine implementation code and measured evidence in the same commit unless the task explicitly says to record evidence.
