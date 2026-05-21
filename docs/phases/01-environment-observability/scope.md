# Scope

## Goal

Phase 2 No Lock Baseline을 실행하기 전에 최소 관측 환경과 반복 실행 경로를 검증한다.

## Target

- Spring Boot actuator metrics
- PostgreSQL exporter
- Prometheus targets
- Grafana dashboard
- k6 smoke test 실행 경로
- reset API 또는 SQL 기반 DB 초기화 절차

## Out of Scope

- 동시성 전략 구현
- 성능 비교 결론 작성
- WireMock 실험 구현
- Redis 및 Redis exporter 관측

## Completion Gate

- [x] Spring `/actuator/prometheus` 응답을 확인했다.
- [x] Prometheus `spring`, `postgres` target 상태를 확인했다.
- [x] Grafana 접속과 dashboard 접근을 확인했다.
- [x] k6 smoke test 실행 경로를 확인했다.
- [x] reset API 또는 SQL 기반 DB 초기화 절차를 확인했다.
- [x] `report.md`에 환경 점검 결과를 기록했다.
