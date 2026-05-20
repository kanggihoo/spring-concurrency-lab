# Observability

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Metrics

| Area | Metric | Purpose |
|---|---|---|
| Spring | `/actuator/prometheus` | 애플리케이션 지표 노출 확인 |
| PostgreSQL | exporter target up | DB 지표 수집 확인 |
| Redis | exporter target up | Redis 지표 수집 확인 |
| k6 | smoke test result | 부하 테스트 경로 확인 |

## Evidence

Prometheus target 화면, Grafana dashboard 화면, k6 smoke result를 필요 시 evidence에 저장한다.
