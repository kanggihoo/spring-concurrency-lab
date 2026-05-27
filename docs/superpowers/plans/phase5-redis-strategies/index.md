# Phase 5 Redis Concurrency Strategies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and measure Redisson Lock and Redis Lua Atomic Decrement against the Phase 4 DB Atomic Conditional Update baselines.

**Architecture:** Keep DB as the durable source of truth for Reservation and counted-seat consistency. Add Redis as a lock coordinator for Redisson and as a fast Remaining Seats gate for Lua, then capture k6, Redis, Spring, and DB evidence under the Phase 5 evidence tree.

**Tech Stack:** Spring Boot 4, Java 21, Spring Data JPA, Spring Data Redis, Redisson, PostgreSQL, Redis, Docker Compose, redis_exporter, Prometheus, Grafana, k6, Makefile.

---

## Source Spec

- `docs/superpowers/specs/2026-05-28-phase5-redis-strategies-design.md`

## Execution Order

Run the plan files in numeric order:

1. [000-redis-infrastructure-and-dependencies.md](./000-redis-infrastructure-and-dependencies.md)
2. [001-redis-seat-store-and-test-support.md](./001-redis-seat-store-and-test-support.md)
3. [002-redisson-lock-strategy.md](./002-redisson-lock-strategy.md)
4. [003-redis-lua-atomic-decrement.md](./003-redis-lua-atomic-decrement.md)
5. [004-k6-makefile-and-evidence-layout.md](./004-k6-makefile-and-evidence-layout.md)
6. [005-measurement-runbook-and-reporting.md](./005-measurement-runbook-and-reporting.md)

## File Map

- Modify `docker-compose.yml`: add Redis and redis_exporter services.
- Modify `prometheus.yml`: scrape redis_exporter.
- Modify `concurrency/build.gradle`: add Spring Data Redis, Redisson, and Testcontainers Redis support.
- Modify `concurrency/src/main/resources/application.yml`: add Redis connection defaults and Phase 5 tuning values.
- Create `concurrency/src/main/java/com/example/concurrency/redis/RedisSeatKey.java`: centralize Redis key naming.
- Create `concurrency/src/main/java/com/example/concurrency/redis/RedisSeatStore.java`: initialize, read, decrement, and compensate Redis Remaining Seats.
- Modify `concurrency/src/main/java/com/example/concurrency/controller/TestController.java`: reset and consistency endpoints include Redis state.
- Modify `concurrency/src/main/java/com/example/concurrency/service/ReservationService.java`: add Redisson and Lua reservation paths.
- Modify `concurrency/src/main/java/com/example/concurrency/controller/ReservationController.java`: expose `/redisson` and `/redis-lua` endpoints.
- Create `concurrency/src/main/java/com/example/concurrency/service/RedisLockAcquireFailedException.java`: classify Redisson lock failure.
- Create `concurrency/src/main/java/com/example/concurrency/service/RedisReservationException.java`: classify Redis/DB compensation failure.
- Create `concurrency/src/test/java/com/example/concurrency/RedisStrategiesConcurrencyTest.java`: concurrent correctness tests for Redisson and Lua.
- Create `concurrency/src/test/java/com/example/concurrency/RedisLuaCompensationTest.java`: forced DB failure compensation test.
- Create `k6/presets/phase5-redisson-lock.json`: Redisson load preset.
- Create `k6/presets/phase5-redis-lua.json`: Lua load preset.
- Create `k6/presets/phase5-atomic-baseline.json`: Atomic baseline load preset.
- Modify `k6/reservation-test.js`: classify Phase 5 response statuses and body status values.
- Modify `Makefile`: add Phase 5 Redis snapshot and consistency evidence targets.
- Modify Phase 5 docs under `docs/phases/05-redis-strategies/`: keep scope, runbook, observability, and report aligned with implementation.

## Commit Strategy

Use one commit per numbered plan file:

- Redis infrastructure and dependencies
- Redis seat store and test support
- Redisson Lock strategy
- Redis Lua Atomic Decrement strategy
- k6, Makefile, and evidence layout
- measurement report and final verification

Do not mix measured evidence with implementation commits except in `005-measurement-runbook-and-reporting.md`.
