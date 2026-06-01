# Makefile Command Interface Refactor Implementation Plan - 003 Common Variable Contract

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `PRESET`의 이중 의미를 `K6_PRESET`과 `GRAFANA_PRESET`으로 분리하고, `grafana-capture`와 `sql-consistency`의 기본 output path를 phase 변수와 연결한다.

**Architecture:** 기존 `PRESET`은 호환용 기본값으로 유지한다. 실제 k6 실행은 `K6_PRESET`, Grafana dashboard variable은 `GRAFANA_PRESET`, Grafana screenshot parts는 `PARTS_DIR`, SQL evidence는 `SQL_OUTPUT`으로 분리한다.

**Tech Stack:** GNU Make variables, bash, npm scripts.

---

## Task 003: Common Variable Contract

**Files:**

- Modify: `makefiles/config.mk`
- Modify: `makefiles/k6.mk`
- Modify: `makefiles/grafana.mk`
- Modify: `makefiles/evidence.mk`
- Modify: `makefiles/sql.mk`
- Modify: `makefiles/help.mk`

- [ ] **Step 1: `makefiles/config.mk` 변수 계약을 확인한다**

Ensure `makefiles/config.mk` contains exactly these derived variables:

```make
PRESET ?= baseline
K6_PRESET ?= $(PRESET)
GRAFANA_PRESET ?= $(PRESET)
PARTS_DIR ?= docs/evidence/$(PHASE)/grafana/parts
SQL_CONDITION ?= $(CONDITION)
SQL_OUTPUT ?= docs/evidence/$(PHASE)/$(EXPERIMENT)/$(SQL_CONDITION)/sql/consistency.txt
```

Do not remove `PRESET`; existing docs and commands still use it.

- [ ] **Step 2: `k6-run`과 `k6-evidence`가 `K6_PRESET`을 사용하게 변경한다**

In `makefiles/k6.mk`, replace:

```make
bash k6/run.sh $(PRESET) $(MODE)
```

with:

```make
bash k6/run.sh $(K6_PRESET) $(MODE)
```

The final targets must be:

```make
k6-run:
	POOL=$(POOL) K6_TAIL_LINES=$(TAIL) bash k6/run.sh $(K6_PRESET) $(MODE)

k6-evidence:
	POOL=$(POOL) K6_EVIDENCE_PHASE_DIR=$(PHASE) K6_TAIL_LINES=$(TAIL) K6_RUN_ID="$(CONDITION)-$$(date +%Y%m%d-%H%M%S)" bash k6/run.sh $(K6_PRESET) $(MODE)
```

- [ ] **Step 3: `grafana-capture`가 `GRAFANA_PRESET`과 `PARTS_DIR`을 항상 사용하게 변경한다**

In `makefiles/grafana.mk`, replace `--preset $(PRESET)` with:

```make
		--preset $(GRAFANA_PRESET) \
```

Replace optional `PARTS_DIR` passing:

```make
		$(if $(PARTS_DIR),--parts-dir $(PARTS_DIR),)
```

with mandatory passing:

```make
		--parts-dir $(PARTS_DIR)
```

The final target must include:

```make
grafana-capture:
	npm run grafana:capture -- \
		--dashboard $(DASHBOARD) \
		--phase $(GRAFANA_PHASE) \
		--scenario $(SCENARIO) \
		--preset $(GRAFANA_PRESET) \
		--pool $(POOL) \
		--run-window $(RUN_WINDOW) \
		$(if $(TABLE),--table $(TABLE),) \
		$(if $(URI),--uri $(URI),) \
		--parts-dir $(PARTS_DIR)
```

- [ ] **Step 4: `evidence-capture`가 분리된 preset 변수를 전달하게 변경한다**

In `makefiles/evidence.mk`, replace the target body with:

```make
evidence-capture:
	$(MAKE) k6-evidence PHASE=$(PHASE) K6_PRESET=$(K6_PRESET) MODE=$(MODE) CONDITION=$(CONDITION) TAIL=$(TAIL) POOL=$(POOL)
	$(MAKE) grafana-capture PHASE=$(PHASE) GRAFANA_PHASE=$(GRAFANA_PHASE) SCENARIO=$(SCENARIO) GRAFANA_PRESET=$(GRAFANA_PRESET) POOL=$(POOL) RUN_WINDOW=$(RUN_WINDOW) TABLE=$(TABLE) URI=$(URI) PARTS_DIR=$(PARTS_DIR)
	$(MAKE) evidence-postprocess PHASE=$(PHASE) OUTPUT=$(OUTPUT)
```

- [ ] **Step 5: `sql-consistency`가 `SQL_OUTPUT`을 사용하게 변경한다**

In `makefiles/sql.mk`, replace `sql-consistency` with:

```make
sql-consistency:
	@test -n "$(PHASE)" || { echo "PHASE is required."; exit 1; }
	@if [[ "$(origin SQL_OUTPUT)" != "command line" && "$(origin SQL_OUTPUT)" != "environment" ]]; then \
		test -n "$(EXPERIMENT)" || { echo "EXPERIMENT is required unless SQL_OUTPUT is provided."; exit 1; }; \
		test -n "$(SQL_CONDITION)" || { echo "SQL_CONDITION is required unless SQL_OUTPUT is provided."; exit 1; }; \
	fi
	@output="$(SQL_OUTPUT)"; \
	mkdir -p "$$(dirname "$$output")"; \
	docker compose exec -T postgres psql -U user -d reservation \
		< scripts/sql/consistency-check.sql \
		> "$$output"
```

This keeps Phase 4's default path and allows Phase 3 wrappers to provide a custom `SQL_OUTPUT`.

- [ ] **Step 6: `help` 출력의 예시와 변수명을 조정한다**

In `makefiles/help.mk`, change common target examples:

```make
	@echo "  make k6-run K6_PRESET=baseline MODE=prometheus"
	@echo "      k6 preset을 실행한다. PRESET은 기존 호환용이고 K6_PRESET이 실제 파일명을 의미한다."
	@echo "  make k6-evidence PHASE=02-no-lock-baseline K6_PRESET=baseline MODE=prometheus CONDITION=baseline"
	@echo "      evidence 파일명을 CONDITION 기반 run id로 남기며 k6를 실행한다."
	@echo "  make grafana-capture PHASE=02-no-lock-baseline GRAFANA_PHASE=phase-02 SCENARIO=no-lock GRAFANA_PRESET=baseline"
	@echo "      Grafana dashboard를 PHASE 기반 parts directory에 캡처한다."
```

Ensure common variable output includes:

```make
	@echo "  K6_PRESET=$(K6_PRESET)"
	@echo "  GRAFANA_PRESET=$(GRAFANA_PRESET)"
	@echo "  PARTS_DIR=$(PARTS_DIR)"
	@echo "  SQL_OUTPUT=$(SQL_OUTPUT)"
```

- [ ] **Step 7: 새 변수 계약을 dry-run으로 검증한다**

Run:

```bash
rtk proxy make -n k6-run K6_PRESET=phase3-pessimistic-baseline MODE=prometheus
rtk proxy make -n k6-run PRESET=baseline MODE=prometheus
rtk proxy make -n grafana-capture PHASE=03-db-strategies/pessimistic-lock GRAFANA_PHASE=phase-03 SCENARIO=pessimistic GRAFANA_PRESET=baseline
rtk proxy make -n evidence-capture PHASE=03-db-strategies/pessimistic-lock K6_PRESET=phase3-pessimistic-baseline GRAFANA_PHASE=phase-03 SCENARIO=pessimistic GRAFANA_PRESET=baseline CONDITION=baseline
rtk proxy make -n sql-consistency PHASE=04-db-operational-limits EXPERIMENT=atomic-pool CONDITION=pool-10
```

Expected output includes:

```text
bash k6/run.sh phase3-pessimistic-baseline prometheus
bash k6/run.sh baseline prometheus
--preset baseline
--parts-dir docs/evidence/03-db-strategies/pessimistic-lock/grafana/parts
docs/evidence/04-db-operational-limits/atomic-pool/pool-10/sql/consistency.txt
```

- [ ] **Step 8: 커밋한다**

Run:

```bash
rtk git add makefiles
rtk git commit -m "refactor: separate make preset variables"
```
