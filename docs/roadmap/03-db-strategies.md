# Phase 3. DB Concurrency Strategies

## Goal

PostgreSQL 기반 동시성 제어 전략을 구현하고 같은 조건에서 비교한다.

## Strategies

- Pessimistic Lock
- Optimistic Lock + Retry
- Atomic Conditional Update

## Key Questions

- DB만으로 정합성을 보장할 수 있는가?
- 충돌률이 높을 때 비관적 락과 낙관적 락의 성능 차이는 어떤가?
- 조건부 UPDATE는 엔티티 락 방식보다 어떤 장단점이 있는가?
- 세 방식의 지연 시간, 처리량, 재시도 비용, lock wait 특성은 어떻게 다른가?

## Completion Criteria

- 각 전략별 정합성 테스트 통과
- 동일 k6 조건에서 방식별 결과 저장
- retry count, sold-out count, lock wait 등 필요한 지표 기록
- `docs/phases/03-db-strategies/report.md`에 방식별 선택 기준 기록

## Phase Docs

- [Phase Hub](../phases/03-db-strategies/README.md)
