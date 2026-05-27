# Observability

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| PostgreSQL | pg_locks | lock wait 확인 |
| PostgreSQL | pg_stat_activity | blocking query 확인 |
| Spring | hikaricp_connections_active | 커넥션 점유 |
| Spring | hikaricp_connections_pending | 커넥션 대기 |
| Spring | hikaricp_connections_max | 적용된 pool size 확인 |
| k6 | p99 | tail latency 악화 확인 |
| k6 | status distribution | `reserved`, `sold_out`, `lock_timeout` 응답 분포 확인 |

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

```sql
SHOW lock_timeout;
```

`SHOW lock_timeout`은 현재 SQL session의 설정만 보여준다. Hikari `connection-init-sql`로 설정한 값은 애플리케이션 connection에 적용되므로, psql session에서 항상 같은 값이 보인다고 가정하지 않는다.
