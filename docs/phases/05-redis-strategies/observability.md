# Observability

Phase 5 compares the DB Atomic Conditional Update baseline with Redisson Lock and Redis Lua Atomic Decrement. Capture k6, Redis, Spring, and DB evidence for each run.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| k6 | RPS, p95, p99 | Compare strategy throughput and latency |
| k6 | status distribution | Confirm `reserved`, `sold_out`, and Redis failure response distribution |
| k6 | `reservation_status_reserved` | reserved response count |
| k6 | `reservation_status_sold_out` | sold-out response count |
| k6 | `reservation_status_lock_acquire_failed` | Redisson lock acquire failure count |
| k6 | `reservation_status_redis_db_sync_failed` | Redis decrement followed by DB failure count |
| Redis | connected clients | Redis connection pressure |
| Redis | command duration | Redis command latency |
| Redis | Remaining Seats value | Compare Redis and DB consistency |
| App | lock acquire fail count | Distributed lock acquire failures |
| App | compensation count | Redis decrement compensation count |
| Spring | Hikari active/pending | DB pool pressure |
| DB | consistency SQL | Counted-seat invariant verification |

## Evidence

Store k6 results, Redis metrics, DB consistency SQL output, and Redis Remaining Seats snapshots separately per strategy and condition.
