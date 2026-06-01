# Grafana Dashboard Generator YAML Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grafana dashboard generator를 YAML spec 기반 compiler 구조로 전환해서 Phase별 metric/panel 추가가 작은 YAML 파일 추가로 끝나게 만든다.

**Architecture:** `scripts/grafana/**/*.yml`은 dashboard, row, query 정의의 source of truth가 되고, `scripts/grafana/lib/*.js`는 YAML을 Grafana JSON으로 컴파일한다. 기존 `npm run grafana:generate`와 Grafana provisioning output path는 유지하고, Playwright capture script는 전체 dashboard 캡처 도구로 유지한다.

**Tech Stack:** Node.js ESM, `yaml` npm package, Node built-in test runner, Grafana dashboard JSON, Prometheus PromQL, Playwright capture script.

---

## Source Spec

- `docs/superpowers/specs/2026-06-01-grafana-dashboard-generator-yaml-refactor-design.md`

## 실행 순서

1. [000-baseline-and-yaml-dependency.md](./000-baseline-and-yaml-dependency.md)
2. [001-yaml-loader-and-query-registry.md](./001-yaml-loader-and-query-registry.md)
3. [002-grafana-builder-and-layout.md](./002-grafana-builder-and-layout.md)
4. [003-dashboard-compiler.md](./003-dashboard-compiler.md)
5. [004-yaml-specs-and-overview-dashboard.md](./004-yaml-specs-and-overview-dashboard.md)
6. [005-generation-entrypoint-and-artifacts.md](./005-generation-entrypoint-and-artifacts.md)
7. [006-capture-script-overview-compatibility.md](./006-capture-script-overview-compatibility.md)
8. [007-final-verification-and-docs.md](./007-final-verification-and-docs.md)

## 파일 맵

생성:

- `scripts/grafana/generate.js`
- `scripts/grafana/dashboards/overview.yml`
- `scripts/grafana/rows/run-summary.yml`
- `scripts/grafana/rows/k6-load.yml`
- `scripts/grafana/rows/spring-api.yml`
- `scripts/grafana/rows/spring-runtime.yml`
- `scripts/grafana/rows/hikari-pool.yml`
- `scripts/grafana/rows/postgres-activity.yml`
- `scripts/grafana/rows/table-access.yml`
- `scripts/grafana/rows/reservation-consistency.yml`
- `scripts/grafana/queries/k6.yml`
- `scripts/grafana/queries/spring.yml`
- `scripts/grafana/queries/hikari.yml`
- `scripts/grafana/queries/postgres.yml`
- `scripts/grafana/queries/reservation.yml`
- `scripts/grafana/lib/yaml-loader.js`
- `scripts/grafana/lib/query-registry.js`
- `scripts/grafana/lib/layout.js`
- `scripts/grafana/lib/grafana-builder.js`
- `scripts/grafana/lib/dashboard-compiler.js`
- `scripts/grafana/lib/write-dashboard.js`
- `scripts/grafana/lib/query-registry.test.js`
- `scripts/grafana/lib/layout.test.js`
- `scripts/grafana/lib/dashboard-compiler.test.js`

수정:

- `package.json`
- `package-lock.json`
- `scripts/generate-grafana-dashboards.js`
- `scripts/capture-grafana-dashboard.js`
- `Makefile`
- `docs/guides/commands.md`
- `docs/guides/grafana-prometheus.md`
- `grafana/dashboards/concurrency-lab-overview.json`

삭제:

- `grafana/dashboards/phase-02-no-lock-baseline.json`

## 구현 경계

- `dashboards/overview.yml`: dashboard metadata, variables, row order만 관리한다.
- `rows/*.yml`: row title과 panel 목록만 관리한다.
- `queries/*.yml`: PromQL alias와 fallback 정책만 관리한다.
- `lib/*.js`: YAML을 읽고 검증한 뒤 Grafana JSON으로 변환한다.
- `capture-grafana-dashboard.js`: row/panel 선택 기능을 추가하지 않는다. 전체 dashboard scroll capture를 유지한다.

## 커밋 단위

각 단계가 통과하면 다음 형식으로 커밋한다.

```bash
git add <changed files>
git commit -m "<type>: <short summary>"
```

권장 커밋:

- `build: add yaml support for grafana generator`
- `feat: add grafana query registry`
- `feat: add grafana dashboard layout builder`
- `feat: compile grafana dashboard yaml`
- `feat: migrate grafana overview dashboard spec`
- `refactor: generate grafana dashboards from yaml`
- `refactor: capture overview dashboard by default`
- `docs: document grafana yaml dashboard workflow`

## 완료 기준

- `npm run grafana:test`가 통과한다.
- `npm run grafana:generate`가 `grafana/dashboards/concurrency-lab-overview.json`을 생성한다.
- 생성된 JSON은 `JSON.parse`로 읽을 수 있다.
- dashboard uid는 `concurrency-lab-overview`이다.
- variables는 `phase`, `scenario`, `preset`, `pool`, `uri`, `table`을 포함한다.
- `grafana/dashboards/phase-02-no-lock-baseline.json`은 제거된다.
- `npm run grafana:capture -- --dashboard overview --help` 흐름이 깨지지 않는다.
- `--dashboard phase2`는 `overview` 호환 alias로 동작한다.
- `git diff --check`가 통과한다.
