# Report

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Summary

Not measured yet.

## Strategy Comparison

| Strategy | RPS | p95 | p99 | Error Rate | Consistency | Redis Evidence | DB Evidence |
|---|---:|---:|---:|---:|---|---|---|
| Atomic Conditional Update pool 10 | | | | | | N/A | |
| Atomic Conditional Update pool 50 | | | | | | N/A | |
| Redisson Lock | | | | | | | |
| Redis Lua Atomic Decrement | | | | | | | |

## Compensation Result

| Scenario | Result | Evidence |
|---|---|---|
| Redis decrement success, DB save failure | | |

## Consistency Result

| Strategy | Reservation Count | Remaining Seats | Seat Count Inconsistency | Overbooking | Redis Remaining Seats |
|---|---:|---:|---:|---|---|
| Atomic Conditional Update pool 10 | | | | | N/A |
| Atomic Conditional Update pool 50 | | | | | N/A |
| Redisson Lock | | | | | |
| Redis Lua Atomic Decrement | | | | | |

## Findings

Not recorded yet.

## Decision

Not recorded yet.

## Next Phase Input

Phase 6에서 중복 요청과 멱등성 처리를 검증한다.
