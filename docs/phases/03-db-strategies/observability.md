# Observability

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| k6 | RPS, p95, p99 | 방식별 성능 비교 |
| App | optimistic retry count | 낙관적 락 재시도 비용 |
| App | sold-out count | 정상 실패 수 |
| Spring | Hikari active/pending | DB 커넥션 사용량 |
| PostgreSQL | pg_locks | lock wait 확인 |

## SQL

정합성 검증 SQL은 Phase 2 기준을 재사용하되, 전략별 evidence 디렉터리에 결과를 분리 저장한다.

- `reservation_count + remaining_seats == initial_seat_count`
- `reservation_count <= initial_seat_count`
