# Phase 1. Environment & Observability

## Goal

Phase 2 No Lock Baseline을 반복 측정할 수 있도록 Spring Boot, PostgreSQL, k6, Prometheus, Grafana 실행과 관측 경로를 준비한다.

Redis와 Redis exporter 관측은 Phase 5 Redis Concurrency Strategies에서 다룬다.

## Key Questions

- Spring Actuator와 Prometheus 지표가 수집되는가?
- PostgreSQL exporter 지표가 수집되는가?
- k6 결과를 반복 실행하고 저장할 수 있는가?
- 테스트 전 DB 상태를 초기화할 수 있는가?
- Grafana에서 Prometheus 기반 지표를 확인할 수 있는가?

## Completion Criteria

- `/actuator/prometheus` 응답 확인
- Prometheus `spring`, `postgres` target 상태 확인
- Grafana dashboard 접속 확인
- k6 smoke test 실행 확인
- reset API 또는 SQL 기반 DB 초기화 절차 확인
- `docs/phases/01-environment-observability/report.md`에 환경 점검 결과 기록

## Phase Docs

- [Phase Hub](../phases/01-environment-observability/README.md)
