# Observability

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| PostgreSQL | `pg_locks` | lock type, relation, mode, granted state별 lock 분포 확인 |
| PostgreSQL | `pg_stat_activity` | wait event, query age, blocking PID, 실행 중 쿼리 확인 |
| Spring | `hikaricp_connections_active` | 사용 중인 DB connection 수 확인 |
| Spring | `hikaricp_connections_pending` | DB connection 대기 pressure 확인 |
| Spring | `hikaricp_connections_max` | 관측된 Hikari pool max와 실험 pool size 일치 여부 확인 |
| k6 | `http_req_duration` | p95/p99 latency source of truth |
| k6 | `reservation_reserved` | HTTP 200 Reservation 성공 수 |
| k6 | `reservation_sold_out` | HTTP 409 sold-out 응답 수 |
| k6 | `reservation_lock_timeout` | HTTP 408 lock timeout 응답 수 |
| k6 | `reservation_unexpected_status` | expected status 밖의 응답 수 |

## PostgreSQL Lock Evidence

- `scripts/sql/pg-lock-wait-snapshot.sql`: `pg_stat_activity`에서 wait event, query age, transaction age, blocking PID, query text를 저장한다.
- `scripts/sql/pg-lock-summary.sql`: `pg_locks`를 lock type, relation, mode, granted 상태별 count로 요약한다.
- `pg-stat-activity.txt`: representative Pessimistic run 중 `pg_stat_activity` 결과를 저장해 tuple 또는 transactionid Lock wait를 직접 확인한다.

Pessimistic Lock 대표 조건인 `pool-10`, `pool-50` 실행 중 별도 evidence 파일로 캡처한다.

## Hikari Evidence

각 k6 run-window JSON의 `startedAt`~`endedAt` 본 실행 구간을 기준으로 `scripts/export-hikari-summary.js`를 실행하고, 다음 값을 `prometheus/hikari-summary.json`에 저장한다.

- `hikariMaxMin`: 본 실행 구간의 `min_over_time(hikaricp_connections_max[range])`
- `hikariMaxMax`: 본 실행 구간의 `max_over_time(hikaricp_connections_max[range])`
- `hikariActiveMax`: 본 실행 구간의 `max(max_over_time(hikaricp_connections_active[range]))`
- `hikariPendingMax`: 본 실행 구간의 `max(max_over_time(hikaricp_connections_pending[range]))`

`grafanaFrom`~`grafanaTo`는 dashboard 표시용 패딩 구간이므로 Hikari summary 계산에 사용하지 않는다. `hikariMaxMin`과 `hikariMaxMax`는 `runWindow.pool`과 같아야 하고, `hikariActiveMax`는 `hikariMaxMax`를 넘으면 안 된다.

Grafana screenshot은 시각 자료이고, report table의 Hikari 값은 JSON evidence를 기준으로 쓴다.
