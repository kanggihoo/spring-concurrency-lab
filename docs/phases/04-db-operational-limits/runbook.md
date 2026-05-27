# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. lock wait를 유발하는 테스트 또는 부하를 실행한다.
2. `pg_locks`, `pg_stat_activity`를 확인하고 결과를 저장한다.
3. 멀티 리소스 락 순서를 엇갈리게 해 deadlock을 유발한다.
4. HikariCP pool size를 변경하며 같은 k6 시나리오를 반복한다.
5. pool size별 결과를 `docs/evidence/04-db-operational-limits/` 아래 실험 종류와 파라미터별 하위 디렉터리에 저장한다.
6. `report.md`에 DB 한계와 권장 설정을 기록한다.

## Related Guides

- [PostgreSQL Monitoring](../../guides/postgres-monitoring.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
