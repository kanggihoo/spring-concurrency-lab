# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| PostgreSQL | pg_locks | lock wait 확인 |
| PostgreSQL | pg_stat_activity | blocking query 확인 |
| Spring | hikaricp_connections_active | 커넥션 점유 |
| Spring | hikaricp_connections_pending | 커넥션 대기 |
| k6 | p99 | tail latency 악화 확인 |

## SQL

```sql
SELECT pid, locktype, relation::regclass, mode, granted
FROM pg_locks
WHERE NOT granted;
```

```sql
SELECT pid, state, wait_event_type, wait_event, query
FROM pg_stat_activity
WHERE wait_event IS NOT NULL;
```
