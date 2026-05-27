# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. Redis와 Redis exporter 상태를 확인한다.
2. 테스트 전 DB와 Redis Remaining Seats를 초기화한다.
3. Atomic Conditional Update pool 10과 pool 50 기준선 결과를 준비한다.
4. Redisson Lock 전략을 실행하고 결과를 저장한다.
5. Redis Lua Atomic Decrement 전략을 실행하고 결과를 저장한다.
6. Redis 차감 성공 후 DB Reservation 저장 실패 시 보상 처리 결과를 확인한다.
7. 각 실행 후 DB consistency SQL과 Redis Remaining Seats 값을 함께 저장한다.
8. `report.md`에 Atomic baseline 대비 장단점을 기록한다.

## Related Guides

- [Redis Monitoring](../../guides/redis-monitoring.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Result Recording](../../guides/result-recording.md)
