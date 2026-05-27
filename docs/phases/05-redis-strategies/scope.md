# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

Redis 기반 동시성 제어 전략의 정합성, 성능, 운영 리스크를 Phase 4의 DB Atomic Conditional Update 기준선과 비교한다.

## Target Strategies and Baselines

- Redisson Distributed Lock
- Redis Lua Atomic Decrement
- DB Atomic Conditional Update baseline

## Baseline Conditions

- Phase 4와 같은 baseline k6 shape를 사용한다: 100 VUs, 10 seconds, Concert 1, Initial Seat Count 100.
- DB 기준선은 Atomic Conditional Update pool 10과 pool 50을 사용한다.
- Pessimistic Lock은 기본 비교 대상이 아니라 correctness reference로만 참고한다.

## Redis Lua Boundary

- Redis Lua는 Redis 안에서 Remaining Seats 확인과 차감을 원자적으로 처리한다.
- 성공 응답은 DB Reservation 저장까지 성공한 뒤에만 반환한다.
- Redis 차감 성공 후 DB 저장 실패가 발생하면 Redis Remaining Seats를 보상 복구한다.
- 비동기 DB 저장, pending Reservation, seat hold, reconciliation worker는 이번 Phase 범위에 넣지 않는다.

## Out of Scope

- Redis Cluster/Redlock 심화 논쟁
- Kafka/Outbox
- 결제 상태머신
- 비동기 DB 동기화 기반 eventual consistency 예약 모델
- 좌석 hold, TTL 기반 pending Reservation

## Completion Gate

- [ ] Redisson 전략 정합성 테스트를 통과했다.
- [ ] Redis Lua 전략 정합성 테스트를 통과했다.
- [ ] Atomic Conditional Update pool 10, pool 50 기준선을 저장했다.
- [ ] 동일 k6 조건에서 Redisson, Lua, Atomic baseline 결과를 저장했다.
- [ ] 각 전략 실행 후 `reservation_count + remaining_seats == initial_seat_count`를 확인했다.
- [ ] 각 전략 실행 후 Reservation 100건, Remaining Seats 0, Seat Count Inconsistency 0, Overbooking false를 확인했다.
- [ ] Redis Lua의 DB 저장 실패 보상 시나리오를 확인했다.
- [ ] Redis 관측 지표를 기록했다.
- [ ] `report.md`에 Redis 전략 선택 기준과 한계를 기록했다.
