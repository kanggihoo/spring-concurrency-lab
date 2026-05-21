# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. 테스트 전 상태를 초기화한다.
2. Pessimistic Lock 전략을 실행하고 결과를 저장한다.
3. Optimistic Lock + Retry 전략을 실행하고 결과를 저장한다.
4. Atomic Conditional Update 전략을 실행하고 결과를 저장한다.
5. Unique Constraint 기반 중복 예약 방지 실험을 실행한다.
6. 동일한 k6 조건으로 각 전략을 최소 3회 반복 측정한다.
7. `report.md`에 비교 결과와 선택 기준을 기록한다.

## Related Guides

- [k6 Load Testing](../../guides/k6-load-testing.md)
- [PostgreSQL Monitoring](../../guides/postgres-monitoring.md)
- [Result Recording](../../guides/result-recording.md)
