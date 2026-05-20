# PostgreSQL Monitoring Guide

PostgreSQL 관측은 DB 락, deadlock, connection pool 병목을 해석하기 위해 사용한다.

## Useful SQL

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
SELECT query, calls, total_exec_time, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

## Evidence

SQL 실행 결과는 Phase별 evidence 아래에 저장한다.

```text
docs/evidence/<phase>/sql/
```
