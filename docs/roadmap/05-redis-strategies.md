# Phase 5. Redis Concurrency Strategies

## Goal

Redis 기반 동시성 제어 전략을 Phase 4에서 확정한 DB Atomic Conditional Update 기준선과 비교한다.

## Strategies

- Redisson Distributed Lock
- Redis Lua Atomic Decrement
- DB Atomic Conditional Update 기준 비교

## Key Questions

- Redisson Lock은 단순 counted-seat 차감에서 DB Atomic Conditional Update보다 빠른가, 아니면 Redis lock 비용 때문에 느린가?
- Redis Lua Atomic Decrement는 sold-out 이후 요청을 DB 앞에서 차단해 RPS와 p95/p99를 개선하는가?
- Redis 차감 성공 후 DB Reservation 저장 실패 시 보상 처리로 counted-seat invariant를 회복할 수 있는가?
- Redis 전략은 Phase 4의 Atomic Conditional Update pool 10, pool 50 기준선과 비교했을 때 어떤 운영 복잡도를 추가하는가?

## Completion Criteria

- Redisson, Lua 전략별 정합성 테스트 통과
- Phase 4와 동일 k6 조건에서 Redisson, Lua, Atomic baseline 결과 저장
- Atomic Conditional Update pool 10, pool 50 기준선과 비교 기록
- 각 실행 후 `reservation_count + remaining_seats == initial_seat_count` 검증
- Redis Lua DB 저장 실패 보상 시나리오 검증
- Redis exporter 또는 Redis command latency 관측 결과 기록
- `docs/phases/05-redis-strategies/report.md`에 Redis 선택 기준과 한계 기록

## Phase Docs

- [Phase Hub](../phases/05-redis-strategies/README.md)
