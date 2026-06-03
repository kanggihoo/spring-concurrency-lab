# Phase 4 Report Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 4 보고서의 모든 주요 수치와 결론을 재현 가능한 evidence 파일에 연결한다.

**Architecture:** 기존 Phase 4 설계와 evidence 구조를 유지하고, k6 summary 형식, 응답 분류 counter, Hikari Prometheus 요약, PostgreSQL lock snapshot SQL 파일만 보강한다. 이후 Phase 4 matrix를 재실행해 `report.md`가 k6 summary, SQL, Prometheus query result, lock snapshot을 일관된 source of truth로 참조하도록 수정한다.

**Tech Stack:** Spring Boot 4, Java 21, PostgreSQL, HikariCP, Docker Compose, k6, Prometheus, Grafana, Node.js, Makefile, PowerShell/Git Bash.

---

## Source Spec

- `docs/superpowers/specs/2026-05-29-phase4-report-hardening-design.md`
- 원본 Phase 4 spec: `docs/superpowers/specs/2026-05-27-phase4-db-operational-limits-design.md`

## 실행 순서

아래 문서를 번호 순서대로 실행한다.

1. [000-k6-summary-and-response-classification.md](./000-k6-summary-and-response-classification.md)
2. [001-postgres-lock-snapshot-sql.md](./001-postgres-lock-snapshot-sql.md)
3. [002-hikari-prometheus-summary.md](./002-hikari-prometheus-summary.md)
4. [003-phase4-rerun-and-evidence-collection.md](./003-phase4-rerun-and-evidence-collection.md)
5. [004-report-and-docs-hardening.md](./004-report-and-docs-hardening.md)
6. [005-final-verification.md](./005-final-verification.md)

## 파일 맵

- Modify `k6/reservation-test.js`: `summaryTrendStats`, preset 기반 expected status, 응답 분류 counter를 추가한다.
- Modify `k6/presets/phase4-atomic-pool.json`: `expectedStatuses: [200, 409]`를 추가한다.
- Modify `k6/presets/phase4-pessimistic-pool.json`: `expectedStatuses: [200, 409]`를 추가한다.
- Modify `k6/presets/phase4-pessimistic-timeout.json`: `expectedStatuses: [200, 409, 408]`를 추가한다.
- Modify `scripts/verify-k6-reservation-responses.js`: 새 k6 응답 정책과 counter 존재를 검증한다.
- Create `scripts/sql/pg-lock-wait-snapshot.sql`: blocker PID와 query age를 포함한 lock wait snapshot을 저장한다.
- Create `scripts/sql/pg-lock-summary.sql`: lock type/mode/granted별 count summary를 저장한다.
- Create `scripts/export-hikari-summary.js`: run-window JSON을 읽어 Prometheus Hikari aggregate를 JSON으로 저장한다.
- Modify `package.json`: Hikari summary export script를 npm script로 등록한다.
- Modify `docs/phases/04-db-operational-limits/runbook.md`: 새 SQL 파일과 Hikari summary 수집 절차를 기록한다.
- Modify `docs/phases/04-db-operational-limits/observability.md`: 새 evidence source를 기록한다.
- Modify `docs/phases/04-db-operational-limits/report.md`: p95/p99 source 통일, response distribution, Hikari summary, lock snapshot 근거를 반영한다.
- Modify `docs/phases/04-db-operational-limits/README.md`: phase status를 실제 상태로 갱신한다.
- Modify `docs/phases/04-db-operational-limits/scope.md`: completion gate를 완료/부분 완료 기준으로 갱신한다.
- Generate evidence under `docs/evidence/04-db-operational-limits/**`.

## 커밋 전략

작업 단위를 아래처럼 분리한다.

- `test/docs`: k6 검증 스크립트와 preset 변경
- `feat`: k6 summary/counter 변경
- `docs`: PostgreSQL lock SQL 파일과 runbook 반영
- `feat`: Hikari Prometheus summary exporter
- `docs`: Phase 4 재실행 evidence
- `docs`: Phase 4 report hardening

기존 사용자가 만든 unrelated git 변경은 되돌리지 않는다.
