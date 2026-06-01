# Makefile Command Interface Refactor Implementation Plan - 002 Domain Target File Split

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Makefile target을 기능별 `makefiles/*.mk` 파일로 이동하되, 아직 target 동작은 바꾸지 않는다.

**Architecture:** 루트 `Makefile`은 include 선언만 남기고, 각 target은 책임별 파일로 이동한다. 이 단계의 핵심은 "동작 보존"이며 `PRESET` 분리와 wrapper 공통화는 다음 단계에서 처리한다.

**Tech Stack:** GNU Make include, bash, npm scripts.

---

## Task 002: Domain Target File Split

**Files:**

- Modify: `Makefile`
- Create: `makefiles/help.mk`
- Create: `makefiles/env.mk`
- Create: `makefiles/app.mk`
- Create: `makefiles/k6.mk`
- Create: `makefiles/grafana.mk`
- Create: `makefiles/evidence.mk`
- Create: `makefiles/sql.mk`
- Create: `makefiles/phase-compat.mk`

- [ ] **Step 1: 루트 `Makefile` include 목록을 완성한다**

Replace the body of `Makefile` with:

```make
ifeq ($(OS),Windows_NT)
SHELL := C:/PROGRA~1/Git/bin/bash.exe
else
SHELL := /bin/bash
endif
.DEFAULT_GOAL := help

include makefiles/config.mk
include makefiles/help.mk
include makefiles/env.mk
include makefiles/app.mk
include makefiles/k6.mk
include makefiles/grafana.mk
include makefiles/evidence.mk
include makefiles/sql.mk
include makefiles/phase-compat.mk
```

- [ ] **Step 2: `makefiles/help.mk`로 help target을 이동한다**

Move the existing `help:` target into `makefiles/help.mk`.

The file must start with:

```make
.PHONY: help

help:
```

Keep the help body from the previous commit, including `K6_PRESET`, `GRAFANA_PRESET`, `PARTS_DIR`, and `SQL_OUTPUT` output.

- [ ] **Step 3: `makefiles/env.mk`로 환경 target을 이동한다**

Create `makefiles/env.mk`:

```make
.PHONY: env-check db-start

env-check:
	@command -v bash >/dev/null || { echo "missing: bash"; exit 1; }
	@command -v docker >/dev/null || { echo "missing: docker"; exit 1; }
	@docker compose version >/dev/null || { echo "missing: docker compose"; exit 1; }
	@command -v node >/dev/null || { echo "missing: node"; exit 1; }
	@command -v npm >/dev/null || { echo "missing: npm"; exit 1; }
	@command -v java >/dev/null || { echo "missing: java"; exit 1; }
	@command -v $(PYTHON) >/dev/null || { echo "missing: $(PYTHON)"; exit 1; }
	@test -f concurrency/gradlew || { echo "missing: concurrency/gradlew"; exit 1; }
	@echo "env-check ok"

db-start:
	docker compose up -d postgres postgres_exporter prometheus grafana
```

- [ ] **Step 4: `makefiles/app.mk`로 서버 target을 이동한다**

Create `makefiles/app.mk` and move the existing `server-start` target unchanged.

The file must start with:

```make
.PHONY: server-start
```

The command body must still validate `POOL_SIZE` and `LOCK_TIMEOUT`, then run `cd concurrency && bash ./gradlew bootRun`.

- [ ] **Step 5: `makefiles/k6.mk`로 k6 target을 이동한다**

Create `makefiles/k6.mk`:

```make
.PHONY: k6-run k6-evidence k6-verify

k6-run:
	POOL=$(POOL) K6_TAIL_LINES=$(TAIL) bash k6/run.sh $(PRESET) $(MODE)

k6-evidence:
	POOL=$(POOL) K6_EVIDENCE_PHASE_DIR=$(PHASE) K6_TAIL_LINES=$(TAIL) K6_RUN_ID="$(CONDITION)-$$(date +%Y%m%d-%H%M%S)" bash k6/run.sh $(PRESET) $(MODE)

k6-verify:
	npm run k6:verify-reservation-responses
```

This step intentionally keeps `$(PRESET)`. `K6_PRESET` is wired in Task 003.

- [ ] **Step 6: `makefiles/grafana.mk`로 Grafana target을 이동한다**

Create `makefiles/grafana.mk`:

```make
.PHONY: grafana-generate grafana-capture

grafana-generate:
	npm run grafana:generate

grafana-capture:
	npm run grafana:capture -- \
		--dashboard $(DASHBOARD) \
		--phase $(GRAFANA_PHASE) \
		--scenario $(SCENARIO) \
		--preset $(PRESET) \
		--pool $(POOL) \
		--run-window $(RUN_WINDOW) \
		$(if $(TABLE),--table $(TABLE),) \
		$(if $(URI),--uri $(URI),) \
		$(if $(PARTS_DIR),--parts-dir $(PARTS_DIR),)
```

- [ ] **Step 7: `makefiles/evidence.mk`로 evidence target을 이동한다**

Create `makefiles/evidence.mk` with these targets moved from the root Makefile:

```make
.PHONY: evidence-capture evidence-postprocess grafana-stitch phase-status
```

Move:

- `evidence-capture`
- `evidence-postprocess`
- `grafana-stitch`
- `phase-status`

Keep command bodies unchanged in this task.

- [ ] **Step 8: `makefiles/sql.mk`로 SQL target을 이동한다**

Create `makefiles/sql.mk`:

```make
.PHONY: sql-consistency
```

Move the existing `sql-consistency` target unchanged.

- [ ] **Step 9: `makefiles/phase-compat.mk`로 phase 전용 target을 이동한다**

Create `makefiles/phase-compat.mk` with:

```make
.PHONY: phase3-grafana-capture phase3-grafana-captures phase3-grafana-stitch phase3-grafana-stitches phase3-sql-consistency phase3-sql-consistencies phase4-sql-consistency
```

Move these existing targets unchanged:

- `phase3-grafana-capture`
- `phase3-grafana-captures`
- `phase3-grafana-stitch`
- `phase3-grafana-stitches`
- `phase3-sql-consistency`
- `phase3-sql-consistencies`
- `phase4-sql-consistency`

- [ ] **Step 10: 동작 보존을 검증한다**

Run:

```bash
rtk proxy make help
rtk proxy make -n k6-run PRESET=baseline MODE=prometheus
rtk proxy make -n grafana-capture PHASE=02-no-lock-baseline GRAFANA_PHASE=phase-02 SCENARIO=no-lock PRESET=baseline
rtk proxy make -n phase3-grafana-capture STRATEGY=pessimistic-lock
rtk proxy make -n phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
rtk git diff --check
```

Expected:

```text
```

All commands exit with status `0`.

- [ ] **Step 11: 커밋한다**

Run:

```bash
rtk git add Makefile makefiles
rtk git commit -m "refactor: split make targets by domain"
```
