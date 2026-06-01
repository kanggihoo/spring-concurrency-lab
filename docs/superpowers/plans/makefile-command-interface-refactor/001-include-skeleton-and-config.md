# Makefile Command Interface Refactor Implementation Plan - 001 Include Skeleton and Config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 루트 `Makefile`을 include 기반 구조로 전환하기 위한 `makefiles/` 골격과 공통 변수 파일을 만든다.

**Architecture:** 먼저 변수 기본값만 `makefiles/config.mk`로 이동한다. 루트 `Makefile`은 `config.mk`를 include하고, 나머지 target은 아직 루트에 남겨서 동작 변경을 최소화한다.

**Tech Stack:** GNU Make include, bash.

---

## Task 001: Include Skeleton and Config

**Files:**

- Modify: `Makefile`
- Create: `makefiles/config.mk`

- [ ] **Step 1: `makefiles/config.mk`를 생성한다**

Create `makefiles/config.mk`:

```make
PHASE ?= 02-no-lock-baseline
GRAFANA_PHASE ?= phase-02
SCENARIO ?= no-lock
PRESET ?= baseline
K6_PRESET ?= $(PRESET)
GRAFANA_PRESET ?= $(PRESET)
MODE ?= prometheus
POOL ?= default
POOL_SIZE ?= 10
LOCK_TIMEOUT ?= 0
PROFILE ?= local
PORT ?= 8080
CONDITION ?= baseline
TAIL ?= 120
PYTHON ?= python.exe
DASHBOARD ?= overview
RUN_WINDOW ?= auto
STRATEGY ?= pessimistic-lock
TABLE ?=
URI ?=
PARTS_DIR ?= docs/evidence/$(PHASE)/grafana/parts
INPUT ?=
OUTPUT ?=
EXPERIMENT ?=
SQL_CONDITION ?= $(CONDITION)
SQL_OUTPUT ?= docs/evidence/$(PHASE)/$(EXPERIMENT)/$(SQL_CONDITION)/sql/consistency.txt
```

- [ ] **Step 2: 루트 `Makefile`에서 변수 기본값을 제거하고 include를 추가한다**

In `Makefile`, keep the existing shell block:

```make
ifeq ($(OS),Windows_NT)
SHELL := C:/PROGRA~1/Git/bin/bash.exe
else
SHELL := /bin/bash
endif
.DEFAULT_GOAL := help
```

Immediately after it, add:

```make
include makefiles/config.mk
```

Remove the old variable block from `PHASE ?= ...` through `EXPERIMENT ?=`.

- [ ] **Step 3: help 출력에 새 preset 변수를 추가한다**

In the existing `help` target, after:

```make
	@echo "  PRESET=$(PRESET)"
```

add:

```make
	@echo "  K6_PRESET=$(K6_PRESET)"
	@echo "  GRAFANA_PRESET=$(GRAFANA_PRESET)"
```

After:

```make
	@echo "  DASHBOARD=$(DASHBOARD)"
```

add:

```make
	@echo "  PARTS_DIR=$(PARTS_DIR)"
	@echo "  SQL_OUTPUT=$(SQL_OUTPUT)"
```

- [ ] **Step 4: 기존 명령이 여전히 해석되는지 확인한다**

Run:

```bash
rtk proxy make -n k6-run PRESET=baseline MODE=prometheus
rtk proxy make -n grafana-capture PHASE=02-no-lock-baseline PRESET=baseline
rtk proxy make help
```

Expected:

```text
bash k6/run.sh baseline prometheus
K6_PRESET=baseline
GRAFANA_PRESET=baseline
PARTS_DIR=docs/evidence/02-no-lock-baseline/grafana/parts
```

- [ ] **Step 5: diff를 확인한다**

Run:

```bash
rtk git diff -- Makefile makefiles/config.mk
rtk git diff --check
```

Expected:

```text
```

`git diff --check` has no output and exits with status `0`.

- [ ] **Step 6: 커밋한다**

Run:

```bash
rtk git add Makefile makefiles/config.mk
rtk git commit -m "refactor: introduce makefile include config"
```
