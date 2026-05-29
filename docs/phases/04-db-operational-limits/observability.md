# Observability

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| PostgreSQL | `pg_locks` | lock mode, granted state, relation별 lock 분포 확인 |
| PostgreSQL | `pg_stat_activity` | wait event, query age, blocking PID 확인 |
| Spring | `hikaricp_connections_active` | 사용 중인 DB connection 수 확인 |
| Spring | `hikaricp_connections_pending` | DB connection 대기 pressure 확인 |
| Spring | `hikaricp_connections_max` | 관측된 Hikari pool max 확인 |
| k6 | `http_req_duration` | p95/p99 latency source of truth |
| k6 | `reservation_reserved` | HTTP 200 Reservation 성공 수 |
| k6 | `reservation_sold_out` | HTTP 409 sold-out 응답 수 |
| k6 | `reservation_lock_timeout` | HTTP 408 lock timeout 응답 수 |
| k6 | `reservation_unexpected_status` | expected status 외 응답 수 |

## PostgreSQL Lock Evidence

- `scripts/sql/pg-lock-wait-snapshot.sql`: `pg_stat_activity`에서 wait event, query age, transaction age, blocking PID, query text를 저장한다.
- `scripts/sql/pg-lock-summary.sql`: `pg_locks`를 lock type, relation, mode, granted 상태별 count로 요약한다.

Pessimistic Lock 대표 조건인 `pool-10`, `pool-50` 실행 중 별도 evidence 파일로 캡처한다.

## Hikari Evidence

각 k6 run-window JSON 기준으로 `scripts/export-hikari-summary.js`를 실행해 다음 값을 `prometheus/hikari-summary.json`에 저장한다.

- `max(hikaricp_connections_max)`
- `max(max_over_time(hikaricp_connections_active[run_window]))`
- `max(max_over_time(hikaricp_connections_pending[run_window]))`

Grafana screenshot은 시각 자료이고, report table의 Hikari 값은 JSON evidence를 기준으로 한다.
