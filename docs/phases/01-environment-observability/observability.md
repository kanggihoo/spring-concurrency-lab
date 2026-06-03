# Observability

Phase 1은 전략별 성능 분석이 아니라 관측 경로가 살아 있는지 확인한다.

## Checks

| Area | Check | Success |
|---|---|---|
| Spring | `/actuator/prometheus` | HTTP 200과 Prometheus text output |
| PostgreSQL | postgres_exporter target | Prometheus target `UP` |
| Prometheus | `spring`, `postgres` targets | active target health `up` |
| Grafana | UI and datasource access | 로그인 및 Prometheus 데이터 접근 가능 |
| k6 | `k6/run.sh baseline prometheus` | status check 통과 또는 실패 원인 기록 |
| Reset | `/api/test/reset` 또는 SQL | 반복 실험 전 DB 상태 초기화 가능 |

## Evidence

기본 evidence는 `report.md`에 기록한다. 스크린샷이나 로그가 판단에 필요하면 `docs/evidence/01-environment-observability/` 아래에 저장한다.
