# Scope

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Goal

실험 전 공통 환경과 관측 경로를 검증한다.

## Target

- Spring Boot actuator metrics
- PostgreSQL exporter
- Redis exporter
- Prometheus targets
- Grafana dashboard
- k6 실행 경로

## Out of Scope

- 동시성 전략 구현
- 성능 비교 결론 작성
- WireMock 실험 구현

## Completion Gate

- [ ] Spring `/actuator/prometheus` 응답을 확인했다.
- [ ] Prometheus target 상태를 확인했다.
- [ ] Grafana 접속과 dashboard 접근을 확인했다.
- [ ] reset API 또는 SQL 초기화 절차를 확인했다.
- [ ] `report.md`에 환경 점검 결과를 기록했다.
