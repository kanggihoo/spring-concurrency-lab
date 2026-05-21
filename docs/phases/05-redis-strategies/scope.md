# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

Redis 기반 동시성 제어 전략의 정합성, 성능, 운영 리스크를 확인한다.

## Target Strategies

- Redisson Distributed Lock
- Redis Lua atomic decrement
- DB 저장 실패 시 최소 보상 처리

## Out of Scope

- Redis Cluster/Redlock 심화 논쟁
- Kafka/Outbox
- 결제 상태머신

## Completion Gate

- [ ] Redisson 전략 정합성 테스트를 통과했다.
- [ ] Redis Lua 전략 정합성 테스트를 통과했다.
- [ ] 동일 k6 조건에서 결과를 저장했다.
- [ ] Redis 관측 지표를 기록했다.
- [ ] `report.md`에 Redis 전략 선택 기준과 한계를 기록했다.
