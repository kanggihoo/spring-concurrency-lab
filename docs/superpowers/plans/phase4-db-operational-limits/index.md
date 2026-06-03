# Phase 4 DB Operational Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement and run Phase 4 DB operational limit experiments for Atomic Conditional Update and Pessimistic Lock under controlled pool size and lock timeout changes.

**Architecture:** Reuse the existing Makefile command interface and k6 runner. Add Phase 4-specific presets, server runtime parameters, generic consistency evidence, and phase documentation, then execute the measurement matrix and record report findings under the renamed `04-db-operational-limits` phase.

**Tech Stack:** Spring Boot 4, Java 21, HikariCP, PostgreSQL, Docker Compose, k6, Prometheus, Grafana, Makefile, PowerShell/Git Bash.

---

## Source Spec

- `docs/superpowers/specs/2026-05-27-phase4-db-operational-limits-design.md`

## Execution Order

Run the plan files in numeric order:

1. [000-command-interface-and-presets.md](./000-command-interface-and-presets.md)
2. [001-phase4-docs-and-evidence-layout.md](./001-phase4-docs-and-evidence-layout.md)
3. [002-atomic-pool-matrix.md](./002-atomic-pool-matrix.md)
4. [003-pessimistic-pool-matrix.md](./003-pessimistic-pool-matrix.md)
5. [004-pessimistic-timeout-matrix.md](./004-pessimistic-timeout-matrix.md)
6. [005-reporting-and-final-verification.md](./005-reporting-and-final-verification.md)

## File Map

- Modify `Makefile`: support `POOL_SIZE`, numeric `LOCK_TIMEOUT`, k6 `POOL` override, generic `sql-consistency`, and `phase4-sql-consistency`.
- Modify `k6/run.sh`: pass the effective pool label to k6 and write it to run-window metadata.
- Modify `k6/reservation-test.js`: allow `__ENV.POOL` to override preset pool labels.
- Create `k6/presets/phase4-atomic-pool.json`: reusable Atomic Conditional Update pool matrix preset.
- Create `k6/presets/phase4-pessimistic-pool.json`: reusable Pessimistic Lock pool matrix preset.
- Create `k6/presets/phase4-pessimistic-timeout.json`: reusable Pessimistic Lock timeout matrix preset.
- Create `scripts/sql/consistency-check.sql`: generic counted-seat consistency SQL evidence query.
- Modify `docs/phases/04-db-operational-limits/scope.md`: align scope with operational limits.
- Modify `docs/phases/04-db-operational-limits/runbook.md`: record exact Phase 4 commands.
- Modify `docs/phases/04-db-operational-limits/observability.md`: record metrics and SQL snapshots.
- Modify `docs/phases/04-db-operational-limits/report.md`: add result tables.
- Modify `docs/guides/commands.md`: document new Makefile variables and Phase 4 SQL evidence command.
- Modify `docs/guides/project-format-standard.md`: keep command standard current.
- Add evidence under `docs/evidence/04-db-operational-limits/` during measurement tasks.

## Commit Strategy

Keep implementation support, docs alignment, each measurement group, and final reporting in separate commits:

- command interface and Phase 4 presets
- Phase 4 docs and evidence layout
- Atomic pool matrix evidence
- Pessimistic pool matrix evidence
- Pessimistic timeout matrix evidence
- final report and verification

Do not mix measured evidence from different experiment groups in one commit unless the task explicitly says to report across groups.
