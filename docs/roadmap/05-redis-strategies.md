# Phase 5. Redis Concurrency Strategies

## Goal

Redis 기반 동시성 제어 전략을 DB 전략과 비교한다.

## Strategies

- Redisson Distributed Lock
- Redis Lua atomic decrement
- Redis 차감 성공 후 DB 저장 실패 시 최소 보상 처리

## Key Questions

- Redis 전략은 DB 락 대비 RPS와 p95/p99를 얼마나 개선하는가?
- Redis Lua는 분산락 대비 어떤 장단점이 있는가?
- Redis와 DB 사이의 불일치 가능성은 어디서 발생하는가?

## Completion Criteria

- Redisson, Lua 전략별 정합성 테스트 통과
- 동일 k6 조건에서 결과 저장
- Redis exporter 또는 Redis command latency 관측 결과 기록
- `docs/phases/05-redis-strategies/report.md`에 Redis 선택 기준과 한계 기록

## Phase Docs

- [Phase Hub](../phases/05-redis-strategies/README.md)
