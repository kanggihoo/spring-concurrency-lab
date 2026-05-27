# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| k6 | RPS, p95, p99 | DB 전략 대비 성능 비교 |
| k6 | status distribution | `reserved`, `sold_out`, Redis/DB failure 응답 분포 확인 |
| Redis | connected clients | Redis 연결 수 |
| Redis | command duration | Redis 명령 지연 |
| Redis | Remaining Seats value | Redis와 DB consistency 비교 |
| App | lock acquire fail count | 분산락 획득 실패 |
| App | compensation count | 보상 처리 발생 수 |
| Spring | Hikari active/pending | DB 부하 감소 여부 |
| DB | consistency SQL | counted-seat invariant 확인 |

## Evidence

전략별 k6 결과, Redis 지표, DB 정합성 SQL 결과, Redis Remaining Seats snapshot을 분리 저장한다.
