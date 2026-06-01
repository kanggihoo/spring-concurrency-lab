# Makefile Command Interface Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 루트 `Makefile`을 기능별 include 구조로 나누고, phase 전용 target을 공통 target의 compatibility wrapper로 정리한다.

**Architecture:** 루트 `Makefile`은 shell 설정과 `makefiles/*.mk` include만 담당한다. 공통 target은 작업 종류 기준으로 유지하고, phase별 차이는 `PHASE`, `K6_PRESET`, `GRAFANA_PRESET`, `SCENARIO`, `CONDITION`, `SQL_OUTPUT` 같은 변수로 전달한다.

**Tech Stack:** GNU Make, bash, Docker Compose, npm scripts, k6 runner shell script, Grafana capture/stitch scripts.

---

## Source Spec

- `docs/superpowers/specs/2026-06-01-makefile-command-interface-refactor-design.md`

## 실행 순서

1. [000-baseline-and-command-contract.md](./000-baseline-and-command-contract.md)
2. [001-include-skeleton-and-config.md](./001-include-skeleton-and-config.md)
3. [002-domain-target-file-split.md](./002-domain-target-file-split.md)
4. [003-common-variable-contract.md](./003-common-variable-contract.md)
5. [004-phase-compatibility-wrappers.md](./004-phase-compatibility-wrappers.md)
6. [005-command-documentation-update.md](./005-command-documentation-update.md)
7. [006-final-verification.md](./006-final-verification.md)

## 파일 맵

생성:

- `makefiles/config.mk`
- `makefiles/help.mk`
- `makefiles/env.mk`
- `makefiles/app.mk`
- `makefiles/k6.mk`
- `makefiles/grafana.mk`
- `makefiles/evidence.mk`
- `makefiles/sql.mk`
- `makefiles/phase-compat.mk`

수정:

- `Makefile`
- `docs/guides/commands.md`
- `docs/guides/project-format-standard.md`

유지:

- `k6/run.sh`
- `k6/presets/*.json`
- `scripts/capture-grafana-dashboard.js`
- `scripts/stitch-grafana-captures.py`
- `scripts/sql/consistency-check.sql`
- `package.json`
- `docker-compose.yml`

## 구현 경계

- `makefiles/config.mk`: 공통 변수 기본값과 파생 변수만 관리한다.
- `makefiles/help.mk`: `make help` 출력만 관리한다.
- `makefiles/env.mk`: 환경 확인과 Docker Compose 관측 도구 실행만 관리한다.
- `makefiles/app.mk`: Spring Boot 서버 실행만 관리한다.
- `makefiles/k6.mk`: k6 실행과 k6 검증만 관리한다.
- `makefiles/grafana.mk`: Grafana dashboard 생성과 캡처만 관리한다.
- `makefiles/evidence.mk`: k6+Grafana+stitch orchestration, stitch alias, phase 상태 확인만 관리한다.
- `makefiles/sql.mk`: SQL consistency evidence 저장만 관리한다.
- `makefiles/phase-compat.mk`: 기존 phase 전용 target의 compatibility wrapper만 관리한다.

## 커밋 단위

각 단계가 통과하면 다음 형식으로 커밋한다.

```bash
git add <changed files>
git commit -m "<type>: <short summary>"
```

권장 커밋:

- `test: capture makefile command baseline`
- `refactor: introduce makefile include config`
- `refactor: split make targets by domain`
- `refactor: separate make preset variables`
- `refactor: wrap phase-specific make targets`
- `docs: update make command guide`
- `test: verify makefile command interface`

## 완료 기준

- `make help`가 공통 target 중심으로 출력된다.
- `make k6-run PRESET=baseline`와 `make k6-run K6_PRESET=baseline`이 모두 동작한다.
- `make grafana-capture PHASE=...`가 `docs/evidence/<PHASE>/grafana/parts`를 기본 parts directory로 사용한다.
- `make evidence-capture`가 `K6_PRESET`과 `GRAFANA_PRESET`을 각각 전달한다.
- `make phase3-grafana-capture`, `make phase3-grafana-stitch`, `make phase3-sql-consistency`, `make phase4-sql-consistency`가 compatibility wrapper로 동작한다.
- 신규 Phase 5/6에서는 phase 전용 target을 만들지 않아도 공통 target과 변수 조합으로 실행할 수 있다.
- `rtk proxy make -n ...` dry-run 검증이 통과한다.
- `rtk proxy make k6-verify`가 통과한다.
- `rtk npm run grafana:generate`가 통과한다.
- `rtk git diff --check`가 통과한다.
