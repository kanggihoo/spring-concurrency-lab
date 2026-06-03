# Makefile Command Interface Refactor Implementation Plan - 000 Baseline and Command Contract

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 Makefile 명령의 기준 동작을 기록하고, 리팩토링 중 깨지면 안 되는 command contract를 명확히 한다.

**Architecture:** 이 단계는 코드 변경 없이 현재 명령 해석 결과를 확인한다. 이후 단계에서 include 분리와 변수 계약 변경을 하더라도 이 기준 명령이 계속 해석되어야 한다.

**Tech Stack:** GNU Make dry-run, bash, npm scripts, git.

---

## Task 000: Baseline and Command Contract

**Files:**

- Read: `Makefile`
- Read: `docs/superpowers/specs/2026-06-01-makefile-command-interface-refactor-design.md`

- [ ] **Step 1: worktree 상태를 확인한다**

Run:

```bash
rtk git status
```

Expected:

```text
* codex/integrate-strategy-refactor
clean - nothing to commit
```

Untracked 또는 modified 파일이 있으면 이번 작업과 관련된 파일인지 확인한다. 관련 없는 사용자 변경은 건드리지 않는다.

- [ ] **Step 2: 현재 Makefile target 목록을 확인한다**

Run:

```bash
rtk proxy make help
```

Expected:

```text
Spring Concurrency Lab command interface
Targets:
  make env-check
  make db-start PROFILE=local
  make server-start PROFILE=local PORT=8080
  make k6-run PRESET=baseline MODE=prometheus
  make k6-evidence PHASE=02-no-lock-baseline PRESET=baseline MODE=prometheus CONDITION=baseline
  make grafana-capture DASHBOARD=overview RUN_WINDOW=auto TABLE=concert
  make phase3-grafana-capture STRATEGY=pessimistic-lock
  make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

목표는 출력 문구를 그대로 보존하는 것이 아니라, 기존 공개 target이 리팩토링 이후에도 사라지지 않게 하는 것이다.

- [ ] **Step 3: 공통 target dry-run 기준선을 확인한다**

Run:

```bash
rtk proxy make -n k6-run PRESET=baseline MODE=prometheus
rtk proxy make -n k6-evidence PHASE=02-no-lock-baseline PRESET=baseline CONDITION=baseline
rtk proxy make -n grafana-capture PHASE=02-no-lock-baseline GRAFANA_PHASE=phase-02 SCENARIO=no-lock PRESET=baseline
rtk proxy make -n evidence-postprocess PHASE=02-no-lock-baseline
```

Expected:

```text
POOL=default K6_TAIL_LINES=120 bash k6/run.sh baseline prometheus
POOL=default K6_EVIDENCE_PHASE_DIR=02-no-lock-baseline ...
npm run grafana:capture -- ...
python.exe scripts/stitch-grafana-captures.py --phase 02-no-lock-baseline
```

`grafana-capture`는 현재 `PARTS_DIR`을 지정하지 않으면 `--parts-dir`이 생략될 수 있다. 이 동작은 이후 단계에서 수정 대상이다.

- [ ] **Step 4: phase compatibility target dry-run 기준선을 확인한다**

Run:

```bash
rtk proxy make -n phase3-grafana-capture STRATEGY=pessimistic-lock
rtk proxy make -n phase3-grafana-stitch STRATEGY=pessimistic-lock
rtk proxy make -n phase3-sql-consistency STRATEGY=pessimistic-lock
rtk proxy make -n phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

Expected:

```text
npm run grafana:capture -- --dashboard overview --phase phase-03 ...
python.exe scripts/stitch-grafana-captures.py --input-dir docs/evidence/03-db-strategies/pessimistic-lock/grafana/parts ...
docker compose exec -T postgres psql -U user -d reservation ...
make sql-consistency PHASE=04-db-operational-limits EXPERIMENT=atomic-pool CONDITION=pool-10
```

리팩토링 후에는 Phase 3 wrapper도 직접 스크립트를 실행하지 않고 공통 target으로 위임해야 한다.

- [ ] **Step 5: 저비용 검증 기준선을 실행한다**

Run:

```bash
rtk proxy make k6-verify
rtk npm run grafana:generate
rtk git diff --check
```

Expected:

```text
> node scripts/verify-k6-reservation-responses.js
> node scripts/generate-grafana-dashboards.js
```

All commands exit with status `0`.

- [ ] **Step 6: 이 단계는 커밋하지 않는다**

이 단계는 baseline 확인만 수행한다. 파일 변경이 없어야 한다.

Run:

```bash
rtk git status
```

Expected:

```text
clean - nothing to commit
```
