# Report

## Summary

Phase 1 환경 점검을 통과했다. Spring Boot, PostgreSQL, postgres_exporter, Prometheus, Grafana, k6 smoke path가 Phase 2 No Lock Baseline을 실행할 수 있는 상태로 확인되었다.

Redis 관측은 이번 Phase의 active gate에서 제외했고, Phase 5 Redis Concurrency Strategies에서 추가 검증한다.

## Execution

| Item | Value |
|---|---|
| Checked At | 2026-05-20 17:35:24 +09:00 |
| Docker Compose | `docker compose up -d` |
| Spring Boot | `concurrency/gradlew.bat bootRun --no-daemon` |
| k6 Smoke | `docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/simple_test.js` |

## Environment Check

| Item | Result | Evidence |
|---|---|---|
| Docker services | PASS | `postgres`, `postgres_exporter`, `prometheus`, `grafana` all running; PostgreSQL healthy |
| Spring metrics | PASS | `GET /actuator/prometheus` returned HTTP 200 and Prometheus text output |
| Prometheus targets | PASS | `postgres` and `spring` active targets returned health `up` |
| Grafana health | PASS | `GET /api/health` returned `database=ok`, version `13.0.1+security-01` |
| Reset API | PASS | `POST /api/test/reset` returned `{"status":"reset","remainingSeats":"100"}` |
| DB reset state | PASS | SQL result: `concert.id=1`, `remaining_seats=100`, `reservation_count=0` |
| k6 smoke test | PASS | 10 VUs for 10s, 810 requests, 100% checks passed, 0% failed |
| k6 remote write | PASS | Prometheus query returned `k6_http_reqs_total=810`, `k6_http_req_failed_rate=0`, `k6_checks_rate=1` |

## k6 Smoke Result

| Scenario | VU | Duration | Requests | RPS | p95 | p99 | Error Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| `simple_test.js` | 10 | 10s | 810 | 80.389685/s | 27.6ms | 32.64ms | 0.00% |

## Findings

- The active Phase 1 gate should not include Redis because the current Compose and Prometheus setup do not define Redis or Redis exporter.
- PostgreSQL exporter is reachable through Prometheus as `postgres`.
- Spring Actuator metrics are reachable by Prometheus through `host.docker.internal:8080`.
- k6 remote write is working; Prometheus has `k6_` metrics after the smoke run.
- Reset API restores the counted-seat baseline needed for repeated Phase 2 runs.

## Next Phase Input

Phase 2 can start using this environment. Before each Phase 2 k6 run, call `POST /api/test/reset` and record both k6 metrics and SQL consistency results in `docs/phases/02-no-lock-baseline/report.md`.
