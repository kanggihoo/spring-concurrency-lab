# 관측 지표

Phase 3는 공용 Grafana overview dashboard를 재사용하고 k6 label로 전략별 실행을 구분한다.

## 라벨 집합

- `phase="phase-03", scenario="pessimistic", preset="baseline", pool="default"`
- `phase="phase-03", scenario="optimistic", preset="baseline", pool="default"`
- `phase="phase-03", scenario="atomic", preset="baseline", pool="default"`

## 판단 기준 원자료

- 지연 시간과 RPS: k6 요약 JSON
- response classification: k6 요약 JSON의 custom counter
- 최종 counted-seat invariant: SQL consistency snapshot
- optimistic lock exhausted: k6 요약 JSON의 `reservation_optimistic_lock_exhausted` custom counter
- lock activity: Prometheus `pg_locks_count` JSON
- lock wait 여부: PostgreSQL `pg_stat_activity`, `pg_locks` snapshot
- Grafana screenshot: 숫자 판단 기준 원자료가 아니라 시각 증거

## 주요 지표

| 영역 | 지표 | 목적 |
| --- | --- | --- |
| k6 | `http_reqs` | 요청 처리량 |
| k6 | `http_req_duration` | p95/p99 지연 시간 |
| k6 | `http_req_failed` | expected status 기준 HTTP 실패율 |
| k6 | `reservation_reserved` | `200 {"status":"reserved"}` 응답 수 |
| k6 | `reservation_sold_out` | `409 {"status":"sold_out"}` 응답 수 |
| k6 | `reservation_optimistic_lock_exhausted` | `409 {"status":"optimistic_lock_exhausted"}` 응답 수 |
| k6 | `reservation_unexpected_status` | 예상 계약 밖의 status/body 응답 수 |
| k6 | `concert_reservation_count` | teardown snapshot의 최종 Reservation 수 |
| k6 | `concert_remaining_seats` | teardown snapshot의 최종 Remaining Seats |
| k6 | `concert_seat_count_inconsistency` | teardown snapshot의 Seat Count Inconsistency |
| k6 | `concert_overbooked` | teardown snapshot의 Overbooking 여부 |
| PostgreSQL | `pg_locks_count` | lock activity 신호 |
| PostgreSQL | `pg_stat_activity.wait_event`, `pg_blocking_pids(pid)` | point-in-time lock wait snapshot |

## 근거 자료 경로

각 전략은 독립 디렉터리에 근거 자료를 저장한다.

- `docs/evidence/03-db-strategies/pessimistic-lock/`
- `docs/evidence/03-db-strategies/optimistic-lock/`
- `docs/evidence/03-db-strategies/atomic-update/`

공통 근거 자료:

- k6 summary JSON: `k6/*-summary.json`
- k6 terminal log: `logs/*.log`
- Grafana run-window JSON: `grafana/run-window-*.json`
- Grafana stitched dashboard: `grafana/stitched-dashboard.png`
- SQL consistency snapshot: `sql/baseline-consistency.txt`
- Prometheus k6 실행 구간 보조 JSON: `prometheus/k6-window-summary.json`

전략별 추가 근거 자료:

- 비관적 락 lock activity: `pessimistic-lock/prometheus/pg-locks-count.json`
- 비관적 락 lock wait snapshot: `pessimistic-lock/sql/pg-stat-activity.txt`, `pessimistic-lock/sql/pg-lock-summary.txt`

## SQL 정합성 확인

SQL consistency snapshot은 Concert 1에 대해 다음 조건을 확인한다.

- `reservation_count + remaining_seats == initial_seat_count`
- `reservation_count <= initial_seat_count`

실행:

```bash
make phase3-sql-consistency STRATEGY=pessimistic-lock
make phase3-sql-consistency STRATEGY=optimistic-lock
make phase3-sql-consistency STRATEGY=atomic-update
```
