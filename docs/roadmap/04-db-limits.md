# Phase 4. DB Operational Limits

## Goal

Phase 3에서 확인한 DB 기반 Reservation 전략이 운영 파라미터 변화에 따라 어떤 한계를 보이는지 측정한다.

Phase 4는 새로운 Reservation 전략을 추가하는 단계가 아니다. Phase 3 baseline k6 조건을 유지하고, DB 운영 파라미터만 변경해 처리량, tail latency, 실패 양상, 정합성 유지 여부를 확인한다.

## Experiments

- Atomic Conditional Update의 pool size별 처리량과 p95/p99 측정
- Pessimistic Lock의 pool size별 lock wait와 p99 지연 측정
- Pessimistic Lock에 `lock_timeout`을 적용했을 때 긴 대기를 빠른 실패로 바꿀 수 있는지 확인
- timeout 또는 sold-out 응답 이후에도 Seat Count Inconsistency와 Overbooking이 0인지 검증

## Key Questions

- Atomic Conditional Update는 pool size 증가에 따라 어느 지점부터 RPS와 p99 개선이 멈추는가?
- Pessimistic Lock의 p99 지연은 `pg_locks`, `pg_stat_activity`, HikariCP pending connection 지표와 어떻게 연결되는가?
- 커넥션 풀을 키우면 성능이 계속 좋아지는가, 아니면 같은 Concert row 경합 때문에 개선이 멈추거나 tail latency가 악화되는가?
- `lock_timeout`을 적용하면 긴 lock wait를 빠른 실패로 바꿀 수 있는가?
- timeout, sold-out, 높은 경합 이후에도 `reservation_count + remaining_seats == initial_seat_count`가 유지되는가?

## Completion Criteria

- Phase 3 baseline k6 조건을 유지하고 Atomic Conditional Update pool size별 k6 결과 저장
- Phase 3 baseline k6 조건을 유지하고 Pessimistic Lock pool size별 k6 결과 저장
- Pessimistic Lock의 `pg_locks`, `pg_stat_activity` lock wait evidence 저장
- `lock_timeout` 값별 HTTP 응답 분포와 p95/p99 결과 저장
- 각 실험 후 consistency SQL 결과 저장
- `docs/phases/04-db-limits/report.md`에 DB pool/timeout 운영 기준 기록

## Parameters

### Fixed k6 Conditions

- 100 VUs
- 10 seconds
- Concert 1
- Initial Seat Count 100
- Phase 3와 같은 sold-out-dominant run

### Variable Parameters

| Area | Values |
|---|---|
| Strategy | Atomic Conditional Update, Pessimistic Lock |
| HikariCP maximumPoolSize | 2, 5, 10, 20, 50 |
| `lock_timeout` | default, 200ms, 500ms, 1000ms |

### Recommended Matrix

| Experiment | Strategy | Pool Size | `lock_timeout` | Required Evidence |
|---|---|---|---|---|
| Atomic pool limit | Atomic Conditional Update | 2, 5, 10, 20, 50 | default | k6 summary, consistency SQL |
| Pessimistic pool/lock wait | Pessimistic Lock | 2, 5, 10, 20, 50 | default | k6 summary, consistency SQL, lock wait snapshot |
| Pessimistic timeout | Pessimistic Lock | representative pool size | 200ms, 500ms, 1000ms | k6 summary, response distribution, consistency SQL, timeout evidence |

Grafana dashboard capture는 모든 조합에 대해 저장하지 않는다. 최저 pool size, 대표 pool size, 최고 pool size, timeout 대표 케이스처럼 해석에 필요한 조합만 캡처한다.

## Out of Scope

- Deadlock 유발 실험. 현재 Reservation 흐름은 한 Reservation이 한 Concert만 다루므로, deadlock 재현은 두 Concert row를 반대 순서로 잠그는 합성 DB 실험에 가깝다.
- `statement_timeout` 정책 검증. 현재 Reservation 쿼리는 짧은 statement 중심이라 Phase 4의 핵심 운영 질문은 `lock_timeout`에 둔다.

## Phase Docs

- [Phase Hub](../phases/04-db-limits/README.md)
