# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

DB 기반 동시성 제어가 어떤 조건에서 느려지거나 실패하는지 확인한다.

## Target

- lock wait
- deadlock
- HikariCP pool size
- PostgreSQL timeout 설정

## Out of Scope

- Redis 장애 실험
- WireMock 외부 API 지연 실험
- Kafka/Outbox

## Completion Gate

- [ ] lock wait evidence를 저장했다.
- [ ] deadlock evidence를 저장했다.
- [ ] pool size별 k6 결과를 저장했다.
- [ ] `pg_locks`, `pg_stat_activity` 관측 결과를 기록했다.
- [ ] `report.md`에 DB 운영 한계와 기준을 기록했다.
