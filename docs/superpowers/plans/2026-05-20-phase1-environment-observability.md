# Phase 1 Environment & Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Phase 1 with the minimum observability gate needed for Phase 2 and verify that gate against the local environment.

**Architecture:** Phase 1 remains a documentation and environment-validation slice. The Docker Compose stack provides PostgreSQL, postgres_exporter, Prometheus, Grafana, and k6; the Spring Boot app runs locally and exposes Actuator metrics to Prometheus through `host.docker.internal`.

**Tech Stack:** Spring Boot, PostgreSQL, postgres_exporter, Prometheus, Grafana, k6, Docker Compose, Markdown phase docs.

---

## File Structure

- Modify `docs/roadmap/01-environment-observability.md`: Phase 1 goal, key questions, and completion criteria without Redis.
- Modify `docs/phases/01-environment-observability/README.md`: Phase hub status and goal without Redis.
- Modify `docs/phases/01-environment-observability/scope.md`: Included targets, excluded Redis scope, completion gate.
- Modify `docs/phases/01-environment-observability/runbook.md`: Reproducible local execution checklist.
- Modify `docs/phases/01-environment-observability/observability.md`: Metrics and checks for Spring, PostgreSQL, Prometheus, Grafana, k6, and reset.
- Modify `docs/phases/01-environment-observability/report.md`: Record the actual execution results from this run.

### Task 1: Align Phase 1 Documentation

**Files:**
- Modify: `docs/roadmap/01-environment-observability.md`
- Modify: `docs/phases/01-environment-observability/README.md`
- Modify: `docs/phases/01-environment-observability/scope.md`
- Modify: `docs/phases/01-environment-observability/runbook.md`
- Modify: `docs/phases/01-environment-observability/observability.md`

- [x] **Step 1: Remove Redis from the active Phase 1 gate**

Replace the Phase 1 goal and checklist so the active gate covers Spring Boot, PostgreSQL, k6, Prometheus, Grafana, and reset only. State explicitly that Redis observability moves to Phase 5.

- [x] **Step 2: Run a consistency scan**

Run: `rg -n "Redis|redis" docs/roadmap/01-environment-observability.md docs/phases/01-environment-observability`

Expected: only out-of-scope or Phase 5 handoff mentions remain.

### Task 2: Verify Local Environment

**Files:**
- No source edits expected.

- [x] **Step 1: Start infrastructure**

Run: `docker compose up -d`

Expected: PostgreSQL, postgres_exporter, Prometheus, and Grafana containers are running.

- [x] **Step 2: Start Spring Boot**

Run from `concurrency`: `./gradlew bootRun`

Expected: Spring Boot listens on `http://localhost:8080`.

- [x] **Step 3: Verify Spring metrics**

Run: `curl http://localhost:8080/actuator/prometheus`

Expected: HTTP 200 with Prometheus text output.

- [x] **Step 4: Verify Prometheus targets**

Run: `curl http://localhost:9090/api/v1/targets`

Expected: `spring` and `postgres` active targets report health `up`.

- [x] **Step 5: Verify Grafana**

Run: `curl http://localhost:3000/api/health`

Expected: HTTP 200 with Grafana health JSON.

- [x] **Step 6: Verify reset**

Run: `curl -X POST http://localhost:8080/api/test/reset`

Expected: HTTP 200 with reset status and remaining seats restored to 100.

- [x] **Step 7: Verify k6 smoke path**

Run: `docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/simple_test.js`

Expected: k6 completes with status checks passing and an acceptable error rate.

### Task 3: Record Phase 1 Report

**Files:**
- Modify: `docs/phases/01-environment-observability/report.md`

- [x] **Step 1: Replace pending report values**

Record execution time, service status, Spring metrics result, Prometheus target result, Grafana health result, reset result, k6 smoke result, findings, and Phase 2 readiness decision.

- [x] **Step 2: Run final documentation scan**

Run: `rg -n "Pending|Redis exporter|redis target|DB/Redis" docs/roadmap/01-environment-observability.md docs/phases/01-environment-observability`

Expected: no stale active-gate text remains.

- [x] **Step 3: Review working tree**

Run: `git diff -- docs/roadmap/01-environment-observability.md docs/phases/01-environment-observability docs/superpowers/specs/2026-05-20-phase1-environment-observability-design.md docs/superpowers/plans/2026-05-20-phase1-environment-observability.md`

Expected: only Phase 1 design, plan, docs, and report changes appear.
