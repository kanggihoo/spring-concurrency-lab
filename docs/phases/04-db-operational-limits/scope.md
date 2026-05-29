# Scope

## Goal

Phase 3에서 확인한 DB 기반 Reservation 전략이 pool size, row lock wait, `lock_timeout` 변화에 따라 어떤 운영 한계를 보이는지 확인한다.

## Target

- Atomic Conditional Update pool size별 처리량과 p95/p99
- Pessimistic Lock pool size별 lock wait와 p95/p99
- Pessimistic Lock `lock_timeout` 적용 후 HTTP 응답 분포와 정합성
- 각 실험 후 Seat Count Inconsistency와 Overbooking 검증

## Out of Scope

- Deadlock 유발 실험
- `statement_timeout` 검증
- Redis 역할 실험
- WireMock 외부 API 지연 실험
- Kafka/Outbox

## Completion Gate

- [x] Atomic Conditional Update pool size별 k6 결과를 저장했다.
- [x] Pessimistic Lock pool size별 k6 결과를 저장했다.
- [x] Pessimistic Lock의 `pg_locks`, `pg_stat_activity` lock wait evidence를 저장했다.
- [x] `lock_timeout` 값별 HTTP 응답 분포와 p95/p99 결과를 저장했다. 이번 workload에서는 HTTP 408 응답이 관측되지 않았다.
- [x] 각 실험 후 consistency SQL 결과를 저장했다.
- [x] `report.md`에 DB pool/timeout 운영 기준과 timeout 한계를 기록했다.
