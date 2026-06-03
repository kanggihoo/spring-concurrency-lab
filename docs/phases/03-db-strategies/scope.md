# 범위

## 목표

PostgreSQL 기반 `Remaining Seats` 차감 전략의 정합성과 성능을 비교한다.

## 성공 기준

- 세 전략 모두 같은 기준 부하 조건에서 실행한다.
- 각 전략의 최종 SQL snapshot으로 counted-seat invariant를 확인한다.
- k6 요약 JSON에 RPS, p95, p99, HTTP failure rate, response classification counter를 저장한다.
- `409` 응답은 body status 기준으로 `sold_out`과 `optimistic_lock_exhausted`를 구분한다.
- Prometheus 보조 JSON은 k6 실행 구간과 비관적 lock activity 확인 용도로 보존한다.
- `report.md`는 새 근거 자료만 근거로 결론을 작성한다.

## 대상 전략

- 비관적 락
- 낙관적 락 + 재시도
- 원자적 조건부 UPDATE

## 범위 밖

- Unique Constraint 기반 중복 Reservation 방지
- 같은 User의 중복 요청 처리
- idempotency key
- Redis 분산락
- Redis Lua
- WireMock 외부 API 지연 실험
- connection pool size matrix
- lock timeout 정책 실험
- SQL `EXPLAIN ANALYZE` 기반 query plan tuning

## 완료 게이트

- [x] 세 DB 전략 기준 부하 실행
- [x] counted-seat invariant 확인
- [x] k6 p95/p99 요약 근거 자료 저장
- [x] `409` body 기반 response classification 저장
- [x] 낙관적 락 `optimistic_lock_exhausted` response classification 근거 저장
- [x] Pessimistic lock activity Prometheus 보조 근거 자료 저장
- [x] Pessimistic lock wait SQL snapshot 저장
- [x] 최종 보고서에 주장 -> 근거 자료 매트릭스 작성
- [x] 한계와 후속 phase 입력 작성
