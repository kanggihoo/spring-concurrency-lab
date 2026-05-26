# Report

## Summary

Not measured yet.

## Strategy Comparison

| Strategy | RPS | p95 | p99 | Expected Failure Rate | Seat Count Inconsistency | Overbooking | Evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| Pessimistic Lock | | | | | | | |
| Optimistic Lock + Retry | | | | | | | |
| Atomic Conditional Update | | | | | | | |

## Strategy Metrics

| Strategy | Retry Count | Sold-out Count | Lock Wait Signal |
|---|---:|---:|---|
| Pessimistic Lock | N/A | | |
| Optimistic Lock + Retry | | | N/A |
| Atomic Conditional Update | N/A | | N/A |

## Findings

Not recorded yet.

## Decision

Not recorded yet.

## Next Phase Input

Phase 4에서 DB 기반 전략의 한계와 운영 리스크를 실험한다.
