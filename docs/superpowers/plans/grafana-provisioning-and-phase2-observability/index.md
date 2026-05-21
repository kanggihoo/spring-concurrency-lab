# Grafana Provisioning and Phase 2 Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision Grafana dashboards from generated files, add Phase 2 consistency snapshot evidence, and automate Grafana scrolling captures for no-lock baseline runs.

**Architecture:** Grafana configuration is file-provisioned through Docker Compose, while dashboard JSON is generated from a Node script. Phase 2 final consistency is exposed through a small Spring test endpoint, pushed to Prometheus by k6 custom metrics, and separately verified with direct SQL evidence. Playwright captures dashboard screenshot parts only; k6 execution, stitching, and report writing stay separate.

**Tech Stack:** Spring Boot 4, Java 21, Gradle, PostgreSQL, Docker Compose, Prometheus, Grafana, k6, Node.js, Playwright.

---

## Source Spec

- `docs/superpowers/specs/2026-05-21-grafana-provisioning-and-phase2-observability-design.md`

## Execution Order

Run the plan files in numeric order:

1. [000-foundation-and-provisioning.md](./000-foundation-and-provisioning.md)
2. [001-dashboard-generator.md](./001-dashboard-generator.md)
3. [002-phase2-consistency-api.md](./002-phase2-consistency-api.md)
4. [003-k6-tags-and-sql-evidence.md](./003-k6-tags-and-sql-evidence.md)
5. [004-playwright-grafana-capture.md](./004-playwright-grafana-capture.md)
6. [005-integration-verification.md](./005-integration-verification.md)

## File Map

- Create `package.json`: Node script entrypoints and Playwright dependency.
- Modify `docker-compose.yml`: Grafana provisioning mounts and anonymous viewer environment.
- Create `grafana/provisioning/datasources/prometheus.yml`: Prometheus datasource with `uid: prometheus`.
- Create `grafana/provisioning/dashboards/dashboards.yml`: File dashboard provider.
- Create `scripts/generate-grafana-dashboards.js`: Source of truth for dashboard JSON.
- Create `grafana/dashboards/concurrency-lab-overview.json`: generated overview dashboard.
- Create `grafana/dashboards/phase-02-no-lock-baseline.json`: generated Phase 2 dashboard.
- Modify `concurrency/src/main/java/com/example/concurrency/controller/TestController.java`: add consistency endpoint.
- Create `concurrency/src/test/java/com/example/concurrency/controller/TestControllerTest.java`: endpoint contract tests.
- Modify `scripts/baseline.js`, `scripts/spike.js`, `scripts/ramp-up.js`, `scripts/sustained.js`: add tags and final consistency snapshot for baseline.
- Create `scripts/sql/phase2-consistency-check.sql`: raw SQL evidence query.
- Create `scripts/capture-grafana-dashboard.js`: Playwright scroll capture script.

## Commit Strategy

Each numbered plan file ends with a commit step. Keep commits scoped:

- provisioning foundation
- dashboard generator
- consistency API
- k6 and SQL evidence
- Playwright capture
- final verification/docs adjustments

Do not combine unrelated implementation tasks in one commit.
