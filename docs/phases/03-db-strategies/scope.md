# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

DB 기반 동시성 제어 전략의 정합성과 성능을 비교한다.

## Target Strategies

- Pessimistic Lock
- Optimistic Lock + Retry
- Atomic Conditional Update
- Unique Constraint

## Out of Scope

- Redis 분산락
- Redis Lua
- WireMock 외부 API 지연 실험

## Completion Gate

- [ ] 각 전략별 정합성 테스트가 있다.
- [ ] 각 전략별 k6 결과를 evidence에 저장했다.
- [ ] SQL 검증 결과를 저장했다.
- [ ] retry, duplicate, sold-out 관련 지표를 기록했다.
- [ ] `report.md`에 DB 전략 선택 기준을 기록했다.
