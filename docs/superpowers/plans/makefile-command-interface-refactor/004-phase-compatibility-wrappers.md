# Makefile Command Interface Refactor Implementation Plan - 004 Phase Compatibility Wrappers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `phase3-*`, `phase4-*` target을 직접 스크립트 실행에서 공통 target wrapper로 바꾼다.

**Architecture:** 새 phase에서는 phase 전용 target을 만들지 않는다. 기존 phase 전용 target은 과거 문서와 evidence 재현성을 위해 유지하되, 내부에서 `grafana-capture`, `evidence-postprocess`, `sql-consistency`를 호출한다.

**Tech Stack:** GNU Make recursive invocation, bash case statement.

---

## Task 004: Phase Compatibility Wrappers

**Files:**

- Modify: `makefiles/phase-compat.mk`

- [ ] **Step 1: Phase 3 strategy 매핑 helper를 명확히 둔다**

In `makefiles/phase-compat.mk`, keep the case mapping in each target body rather than introducing a generated Make macro. Use this mapping exactly:

```make
case "$$strategy" in \
	pessimistic-lock) scenario="pessimistic" ;; \
	optimistic-lock) scenario="optimistic" ;; \
	atomic-update) scenario="atomic" ;; \
	*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
esac
```

This avoids a second Make-specific abstraction while keeping the mapping readable.

- [ ] **Step 2: `phase3-grafana-capture`를 공통 `grafana-capture` wrapper로 변경한다**

Replace `phase3-grafana-capture` with:

```make
phase3-grafana-capture:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock) scenario="pessimistic" ;; \
		optimistic-lock) scenario="optimistic" ;; \
		atomic-update) scenario="atomic" ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	$(MAKE) grafana-capture \
		PHASE=03-db-strategies/$$strategy \
		GRAFANA_PHASE=phase-03 \
		SCENARIO=$$scenario \
		GRAFANA_PRESET=baseline \
		POOL=$(POOL) \
		RUN_WINDOW=$(RUN_WINDOW) \
		PARTS_DIR=docs/evidence/03-db-strategies/$$strategy/grafana/parts
```

`RUN_WINDOW=auto` will resolve the latest run-window JSON from the strategy-specific Grafana directory through `PARTS_DIR`.

- [ ] **Step 3: `phase3-grafana-captures`가 `$(MAKE)`를 사용하게 변경한다**

Replace:

```make
make phase3-grafana-capture STRATEGY=pessimistic-lock MODE=$(MODE) POOL=$(POOL)
```

with:

```make
$(MAKE) phase3-grafana-capture STRATEGY=pessimistic-lock MODE=$(MODE) POOL=$(POOL)
```

The final target must be:

```make
phase3-grafana-captures:
	$(MAKE) phase3-grafana-capture STRATEGY=pessimistic-lock MODE=$(MODE) POOL=$(POOL)
	$(MAKE) phase3-grafana-capture STRATEGY=optimistic-lock MODE=$(MODE) POOL=$(POOL)
	$(MAKE) phase3-grafana-capture STRATEGY=atomic-update MODE=$(MODE) POOL=$(POOL)
```

- [ ] **Step 4: `phase3-grafana-stitch`를 공통 `evidence-postprocess` wrapper로 변경한다**

Replace `phase3-grafana-stitch` with:

```make
phase3-grafana-stitch:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock|optimistic-lock|atomic-update) ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	$(MAKE) evidence-postprocess PHASE=03-db-strategies/$$strategy
```

- [ ] **Step 5: `phase3-grafana-stitches`가 `$(MAKE)`를 사용하게 변경한다**

The final target must be:

```make
phase3-grafana-stitches:
	$(MAKE) phase3-grafana-stitch STRATEGY=pessimistic-lock
	$(MAKE) phase3-grafana-stitch STRATEGY=optimistic-lock
	$(MAKE) phase3-grafana-stitch STRATEGY=atomic-update
```

- [ ] **Step 6: `phase3-sql-consistency`를 공통 `sql-consistency` wrapper로 변경한다**

Replace `phase3-sql-consistency` with:

```make
phase3-sql-consistency:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock|optimistic-lock|atomic-update) ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	$(MAKE) sql-consistency \
		PHASE=03-db-strategies/$$strategy \
		SQL_OUTPUT=docs/evidence/03-db-strategies/$$strategy/sql/baseline-consistency.txt
```

- [ ] **Step 7: `phase3-sql-consistencies`가 `$(MAKE)`를 사용하게 변경한다**

The final target must be:

```make
phase3-sql-consistencies:
	$(MAKE) phase3-sql-consistency STRATEGY=pessimistic-lock
	$(MAKE) phase3-sql-consistency STRATEGY=optimistic-lock
	$(MAKE) phase3-sql-consistency STRATEGY=atomic-update
```

- [ ] **Step 8: `phase4-sql-consistency`가 공통 target wrapper임을 유지한다**

Ensure the target remains:

```make
phase4-sql-consistency:
	$(MAKE) sql-consistency PHASE=04-db-operational-limits EXPERIMENT=$(EXPERIMENT) CONDITION=$(CONDITION)
```

- [ ] **Step 9: wrapper dry-run을 검증한다**

Run:

```bash
rtk proxy make -n phase3-grafana-capture STRATEGY=pessimistic-lock
rtk proxy make -n phase3-grafana-stitch STRATEGY=pessimistic-lock
rtk proxy make -n phase3-sql-consistency STRATEGY=pessimistic-lock
rtk proxy make -n phase3-grafana-captures
rtk proxy make -n phase3-grafana-stitches
rtk proxy make -n phase3-sql-consistencies
rtk proxy make -n phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

Expected output includes:

```text
make grafana-capture PHASE=03-db-strategies/pessimistic-lock GRAFANA_PHASE=phase-03 SCENARIO=pessimistic GRAFANA_PRESET=baseline
make evidence-postprocess PHASE=03-db-strategies/pessimistic-lock
make sql-consistency PHASE=03-db-strategies/pessimistic-lock SQL_OUTPUT=docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt
make sql-consistency PHASE=04-db-operational-limits EXPERIMENT=atomic-pool CONDITION=pool-10
```

- [ ] **Step 10: 잘못된 strategy가 실패하는지 확인한다**

Run:

```bash
rtk proxy make -n phase3-grafana-capture STRATEGY=unknown
```

Expected:

```text
Unknown STRATEGY=unknown. Expected pessimistic-lock, optimistic-lock, or atomic-update.
```

The command exits with non-zero status.

- [ ] **Step 11: 커밋한다**

Run:

```bash
rtk git add makefiles/phase-compat.mk
rtk git commit -m "refactor: wrap phase-specific make targets"
```
