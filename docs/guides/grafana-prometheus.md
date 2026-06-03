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

## Dashboard YAML Workflow

Grafana dashboard의 편집 기준은 generated JSON이 아니라 YAML spec이다.

```text
scripts/grafana/dashboards/overview.yml
scripts/grafana/rows/*.yml
scripts/grafana/queries/*.yml
```

역할:

- `dashboards/overview.yml`: dashboard metadata, variables, row 순서
- `rows/*.yml`: row title과 panel 목록
- `queries/*.yml`: PromQL alias와 expression

연결 규칙:

```text
rows/*.yml 의 panel.query 값 == queries/*.yml 의 key
```

Grafana capture는 별도 YAML을 사용하지 않는다. `scripts/capture-grafana-dashboard.js`는 `overview` dashboard 전체를 Playwright로 스크롤 캡처하고, phase/scenario/preset/pool은 URL variable로 전달한다.
