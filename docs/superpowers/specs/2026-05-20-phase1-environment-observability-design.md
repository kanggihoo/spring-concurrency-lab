# Phase 1 Environment & Observability Design

## Context

Phase 1 prepares the minimum repeatable measurement environment needed to enter Phase 2, No Lock Baseline. The current repository already has Docker Compose services for PostgreSQL, postgres_exporter, Prometheus, Grafana, and k6. Redis is planned for later Redis strategy work, but it is not part of the current Compose or Prometheus setup.

## Decision

Phase 1 will use the minimum observability gate needed for Phase 2:

- Spring Boot application metrics through `/actuator/prometheus`
- PostgreSQL container and postgres_exporter metrics
- Prometheus target checks for `spring` and `postgres`
- Grafana access with Prometheus-backed dashboards or datasource
- k6 smoke test execution with Prometheus remote write enabled
- reset API or SQL-based data reset before repeated experiments

Redis and Redis exporter are out of scope for Phase 1. They will be introduced when Phase 5 starts Redis concurrency strategy work.

## Scope

Phase 1 includes:

- Running the infrastructure stack with `docker compose up -d`
- Running the Spring Boot application from the `concurrency` module
- Verifying `GET /actuator/prometheus`
- Verifying Prometheus target health for Spring and PostgreSQL
- Verifying Grafana login and access to Prometheus data
- Verifying `POST /api/test/reset`
- Running `scripts/simple_test.js` through the k6 Docker service
- Recording results in `docs/phases/01-environment-observability/report.md`

Phase 1 excludes:

- Redis and Redis exporter setup
- DB lock strategy implementation
- Redis lock strategy implementation
- No-lock consistency conclusions
- Cross-strategy performance comparison

## Runbook Design

The runbook should be a reproducible checklist:

1. Start infrastructure with `docker compose up -d`.
2. Start the Spring Boot app from the `concurrency` module.
3. Call `GET http://localhost:8080/actuator/prometheus`.
4. Check `http://localhost:9090/targets` for `spring` and `postgres`.
5. Open Grafana at `http://localhost:3000` and confirm Prometheus data access.
6. Call `POST http://localhost:8080/api/test/reset`.
7. Run `docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/simple_test.js`.
8. Confirm k6 output and, when available, k6 metrics in Prometheus.
9. Record the result and any issues in the Phase 1 report.

## Observability Design

Phase 1 observes whether the measurement path is alive, not whether a strategy is fast.

| Area | Check | Success |
|---|---|---|
| Spring | `/actuator/prometheus` | HTTP 200 and Prometheus text output |
| PostgreSQL | postgres_exporter target | Prometheus target is `UP` |
| Prometheus | targets/query | Spring and PostgreSQL are visible |
| Grafana | UI access | Login works and Prometheus data can be queried |
| k6 | smoke test | Test completes and reports status checks |
| Reset | `/api/test/reset` | HTTP 200 and test state is restored |

## Evidence Design

The Phase 1 report should record:

- execution time
- service status
- checked URLs and commands
- Prometheus target result
- Grafana access result
- reset result
- k6 smoke test summary
- issues found
- whether Phase 2 can start

Screenshots are optional in Phase 1. They should be saved under `docs/evidence/01-environment-observability/` only when they clarify a failure or preserve useful proof.

## Implementation Impact

The expected edits are limited to the Phase 1 roadmap and phase documents. Existing Phase 2 code and user changes should not be reverted. If execution reveals a configuration gap, the fix should stay within the Phase 1 environment surface unless Phase 2 behavior is directly blocked.
