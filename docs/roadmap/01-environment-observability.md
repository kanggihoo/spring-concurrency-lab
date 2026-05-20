# Phase 1. Environment & Observability

## Goal

Spring Boot, PostgreSQL, Redis, k6, Prometheus, Grafana를 같은 기준으로 실행하고 관측할 수 있는 환경을 준비한다.

## Key Questions

- Spring Actuator와 Prometheus 지표가 수집되는가?
- PostgreSQL exporter와 Redis exporter 지표가 수집되는가?
- k6 결과를 반복 실행하고 저장할 수 있는가?
- 테스트 전 DB/Redis 상태를 초기화할 수 있는가?

## Completion Criteria

- `/actuator/prometheus` 응답 확인
- Prometheus target 상태 확인
- Grafana dashboard 접속 확인
- reset API 또는 SQL 초기화 절차 확인
- `docs/phases/01-environment-observability/report.md`에 환경 점검 결과 기록

## Phase Docs

- [Phase Hub](../phases/01-environment-observability/README.md)
