# Grafana and Prometheus Guide

Prometheus와 Grafana는 k6 결과, Spring 지표, PostgreSQL/Redis 지표를 같은 시간축에서 비교하기 위해 사용한다.

## Prometheus Checks

- Spring target up
- PostgreSQL exporter target up
- Redis exporter target up
- k6 remote write 또는 k6 결과 수집 확인

## Grafana Evidence

Grafana screenshot은 Phase별 evidence 아래에 저장한다.

```text
docs/evidence/<phase>/grafana/
```

## Useful Panels

- k6 RPS
- k6 p95/p99
- HTTP error rate
- Hikari active connections
- Hikari pending connections
- JVM thread states
- PostgreSQL lock/activity
- Redis command latency
