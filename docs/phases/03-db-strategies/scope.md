# Scope

## Goal

PostgreSQL 기반 Remaining Seats 차감 전략의 정합성과 성능을 비교한다.

## Target Strategies

- Pessimistic Lock
- Optimistic Lock + Retry
- Atomic Conditional Update

## Out of Scope

- Unique Constraint 기반 중복 Reservation 방지
- 같은 User의 중복 요청 처리
- idempotency key
- Redis 분산락
- Redis Lua
- WireMock 외부 API 지연 실험

## Completion Gate

- [ ] 각 전략별 정합성 테스트가 있다.
- [ ] 각 전략별 k6 결과를 evidence에 저장했다.
- [ ] SQL 검증 결과를 저장했다.
- [ ] retry, sold-out, lock wait 관련 지표를 기록했다.
- [ ] `report.md`에 DB 전략 선택 기준을 기록했다.
