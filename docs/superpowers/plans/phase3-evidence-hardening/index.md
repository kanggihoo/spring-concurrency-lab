# Phase 3 Evidence Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 3 DB strategy 비교 보고서의 모든 핵심 수치와 결론을 새로 수집한 재현 가능한 evidence에 연결한다.

**Architecture:** 기존 Phase 3 예약 전략 구현은 유지하고, API 응답 계약 테스트, k6 summary/counter, Prometheus raw query exporter, PostgreSQL lock snapshot SQL만 보강한다. 이후 세 전략을 같은 baseline 조건에서 한 번씩 다시 실행하고, 수집된 k6 summary, SQL snapshot, Prometheus raw JSON, Grafana run-window만 근거로 `report.md`와 phase 문서를 갱신한다.

**Tech Stack:** Spring Boot 4, Java 21, Gradle, PostgreSQL, Docker Compose, k6, Prometheus, Grafana, Node.js, Makefile, Bash.

---

## Source Spec

- `docs/superpowers/specs/2026-05-30-phase3-evidence-hardening-design.md`
- 원본 Phase 3 spec: `docs/superpowers/specs/2026-05-26-phase3-db-strategies-design.md`

## 실행 원칙

- 이 계획은 구현 계획이다. 문서에 적힌 task를 실행하기 전까지 애플리케이션 코드, k6 코드, evidence는 변경하지 않는다.
- Phase 3 baseline expected HTTP status는 `200`, `409`만 둔다.
- `409`는 response body의 `status` 값으로 `sold_out`과 `optimistic_lock_exhausted`를 분리한다.
- `408 lock_timeout`은 Phase 3 baseline expected result가 아니다. 관측되면 `reservation_unexpected_status` 또는 report의 이상 징후로 기록한다.
- 세 전략별 결론은 evidence 수집 후 작성한다. `Atomic`을 사전에 기본 전략으로 확정하지 않는다.

## 실행 순서

아래 문서를 번호 순서대로 실행한다.

1. [000-api-contract-and-archive-baseline.md](./000-api-contract-and-archive-baseline.md)
2. [001-k6-summary-and-response-classification.md](./001-k6-summary-and-response-classification.md)
3. [002-prometheus-and-lock-evidence-tools.md](./002-prometheus-and-lock-evidence-tools.md)
4. [003-phase3-rerun-and-evidence-collection.md](./003-phase3-rerun-and-evidence-collection.md)
5. [004-report-and-docs-hardening.md](./004-report-and-docs-hardening.md)
6. [005-final-verification.md](./005-final-verification.md)

## 파일 맵

- Create `concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java`: Phase 3 API 응답 계약을 고정한다.
- Modify `scripts/verify-k6-reservation-responses.js`: k6 응답 정책, p99 summary, response counter 존재를 검증한다.
- Modify `k6/reservation-test.js`: `summaryTrendStats`, preset 기반 expected status, body 기반 response classification counter를 추가한다.
- Modify `k6/presets/phase3-pessimistic-baseline.json`: `"expectedStatuses": [200, 409]`를 명시한다.
- Modify `k6/presets/phase3-optimistic-baseline.json`: `"expectedStatuses": [200, 409]`를 명시한다.
- Modify `k6/presets/phase3-atomic-baseline.json`: `"expectedStatuses": [200, 409]`를 명시한다.
- Create `scripts/export-phase3-prometheus-evidence.js`: run-window JSON을 기준으로 Prometheus raw query 결과를 strategy evidence 디렉터리에 저장한다.
- Create `scripts/sql/pg-stat-activity-phase3.sql`: Pessimistic 실행 중 wait/blocking snapshot을 저장한다.
- Create `scripts/sql/pg-lock-summary.sql`: PostgreSQL lock activity summary를 저장한다.
- Modify `package.json`: Phase 3 Prometheus evidence exporter npm script를 등록한다.
- Generate evidence under `docs/evidence/03-db-strategies/<strategy>/**`: 새 baseline 실행 결과를 저장한다.
- Modify `docs/phases/03-db-strategies/report.md`: 새 evidence만 근거로 결과, 한계, 결론을 작성한다.
- Modify `docs/phases/03-db-strategies/README.md`: Phase 3 상태를 실제 완료 상태로 갱신한다.
- Modify `docs/phases/03-db-strategies/scope.md`: completion gate를 evidence 기준으로 갱신한다.
- Modify `docs/phases/03-db-strategies/observability.md`: source of truth와 raw query evidence 위치를 기록한다.
- Modify `docs/phases/03-db-strategies/runbook.md`: Phase 3 재실행 및 evidence 수집 절차를 기록한다.

## 커밋 전략

각 task는 독립적으로 검증 가능한 커밋을 만든다.

- `test: lock phase3 reservation response contract`
- `feat: classify phase3 reservation responses in k6`
- `feat: add phase3 prometheus and lock evidence tools`
- `docs: collect phase3 hardened evidence`
- `docs: update phase3 hardened report`
- `docs: verify phase3 evidence hardening`

사용자나 다른 작업자가 만든 unrelated git 변경은 되돌리지 않는다.
