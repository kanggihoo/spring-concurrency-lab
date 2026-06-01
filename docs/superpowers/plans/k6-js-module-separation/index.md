# k6 JS Module Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `k6/reservation-test.js`를 k6 lifecycle orchestration만 담당하도록 줄이고, 환경설정, scenario option, metric, 요청 실행, 응답 분류, consistency 처리를 독립 JS 모듈로 분리한다.

**Architecture:** 기존 `k6/presets/*.json`, `k6/run.sh`, Makefile, Docker Compose 실행 경로는 유지한다. `k6/lib/*.js`에 책임별 모듈을 추가하고, `reservation-test.js`는 각 모듈을 조립하는 얇은 entrypoint가 된다.

**Tech Stack:** k6 JavaScript runtime, k6 built-in modules, Node.js ESM static verification script, Docker `grafana/k6` inspect command, Makefile.

---

## Source Spec

- `docs/superpowers/specs/2026-06-01-k6-js-module-separation-design.md`

## 실행 순서

1. [000-baseline-and-static-guard.md](./000-baseline-and-static-guard.md)
2. [001-config-and-scenarios.md](./001-config-and-scenarios.md)
3. [002-metrics-and-response-classifier.md](./002-metrics-and-response-classifier.md)
4. [003-consistency-module.md](./003-consistency-module.md)
5. [004-reservation-scenario-and-entrypoint.md](./004-reservation-scenario-and-entrypoint.md)
6. [005-final-verification-and-docs.md](./005-final-verification-and-docs.md)

## 파일 맵

생성:

- `k6/lib/config.js`
- `k6/lib/scenarios.js`
- `k6/lib/metrics.js`
- `k6/lib/response-classifier.js`
- `k6/lib/consistency.js`
- `k6/lib/reservation-scenario.js`

수정:

- `k6/reservation-test.js`
- `scripts/verify-k6-reservation-responses.js`
- `docs/guides/k6-load-testing.md`

유지:

- `k6/presets/*.json`
- `k6/run.sh`
- `Makefile`
- `docker-compose.yml`
- `package.json`
- `package-lock.json`

## 구현 경계

- `config.js`: preset/env 로딩, 필수값 검증, 실행 config 정규화만 담당한다.
- `scenarios.js`: k6 `options`와 executor별 scenario option 생성만 담당한다.
- `metrics.js`: custom Counter/Gauge 선언과 counter seed만 담당한다.
- `response-classifier.js`: expected status callback, HTTP 응답 분류, metric increment 연결만 담당한다.
- `consistency.js`: setup reset과 teardown consistency snapshot만 담당한다.
- `reservation-scenario.js`: VU 1회 Reservation 요청 실행만 담당한다.
- `reservation-test.js`: k6 lifecycle 함수에서 위 모듈을 호출하는 orchestration만 담당한다.

## 커밋 단위

각 단계가 통과하면 다음 형식으로 커밋한다.

```bash
git add <changed files>
git commit -m "<type>: <short summary>"
```

권장 커밋:

- `test: add k6 module separation guard`
- `refactor: extract k6 config and scenarios`
- `refactor: extract k6 metrics and response classifier`
- `refactor: extract k6 consistency handling`
- `refactor: slim k6 reservation entrypoint`
- `docs: document k6 module layout`

## 완료 기준

- `npm run k6:verify-reservation-responses`가 통과한다.
- `make k6-verify`가 통과한다.
- `grafana/k6 inspect`로 모든 `k6/presets/*.json` preset이 import/runtime 초기화 오류 없이 읽힌다.
- `k6/reservation-test.js`에는 k6 lifecycle orchestration만 남는다.
- 기존 custom metric 이름이 유지된다.
- 기존 label 계약인 `phase`, `scenario`, `preset`, `pool`이 유지된다.
- `k6/presets/*.json`, `k6/run.sh`, `Makefile`, `docker-compose.yml`은 동작 변경 없이 유지된다.
- `git diff --check`가 통과한다.
