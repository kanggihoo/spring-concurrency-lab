# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

각 전략의 정합성, 성능, 운영 복잡도를 비교해 통합 프로젝트 적용 기준을 만든다.

## Target

- No Lock
- Pessimistic Lock
- Optimistic Lock + Retry
- Atomic Conditional Update
- Unique Constraint
- Redisson Lock
- Redis Lua
- WireMock payment-adjacent scenarios

## Out of Scope

- 새로운 기능 구현
- 실제 PG 결제 연동
- Kafka/Outbox 본격 구현

## Completion Gate

- [ ] 전체 전략 비교표를 완성했다.
- [ ] evidence 링크가 정리되어 있다.
- [ ] 통합 프로젝트에 가져갈 전략을 결정했다.
- [ ] 결제 프로젝트로 넘길 주제를 분리했다.
