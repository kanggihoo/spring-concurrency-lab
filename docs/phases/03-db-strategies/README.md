# Phase 3. PostgreSQL 예약 동시성 전략

## 상태

보강된 근거 자료 기준 완료

## 목표

PostgreSQL 기반으로 `Remaining Seats`를 차감하는 세 가지 전략을 같은 기준 부하 조건에서 비교한다. 핵심은 성공한 `Reservation` 수와 `Remaining Seats`가 항상 `Initial Seat Count`를 설명하는지 확인하고, 정합성을 얻기 위해 각 전략이 치르는 처리량/지연 시간/운영 복잡도 비용을 비교하는 것이다.

## 대상 전략

- 비관적 락
- 낙관적 락 + 재시도
- 원자적 조건부 UPDATE

## 문서

- [범위](./scope.md)
- [재실행 절차](./runbook.md)
- [관측 지표](./observability.md)
- [최종 보고서](./report.md)

## 근거 자료

- [비관적 락](../../evidence/03-db-strategies/pessimistic-lock)
- [낙관적 락 + 재시도](../../evidence/03-db-strategies/optimistic-lock)
- [원자적 조건부 UPDATE](../../evidence/03-db-strategies/atomic-update)

최종 결론과 수치 해석은 [최종 보고서](./report.md)를 기준으로 한다. Grafana 이미지는 시각 증거이고, 핵심 숫자 판단은 k6 요약 JSON과 SQL snapshot을 우선한다. Prometheus는 실행 구간과 `pg_locks_count` lock activity 보조 지표로 사용한다.
