# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. Redis와 Redis exporter 상태를 확인한다.
2. 테스트 전 DB와 Redis 재고를 초기화한다.
3. Redisson Lock 전략을 실행하고 결과를 저장한다.
4. Redis Lua 전략을 실행하고 결과를 저장한다.
5. DB 저장 실패 시 최소 보상 처리 결과를 확인한다.
6. `report.md`에 DB 전략 대비 장단점을 기록한다.

## Related Guides

- [Redis Monitoring](../../guides/redis-monitoring.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Result Recording](../../guides/result-recording.md)
