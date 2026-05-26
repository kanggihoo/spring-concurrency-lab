SHELL := /bin/bash
.DEFAULT_GOAL := help

PHASE ?= 02-no-lock-baseline
GRAFANA_PHASE ?= phase-02
SCENARIO ?= no-lock
PRESET ?= baseline
MODE ?= prometheus
POOL ?= default
PROFILE ?= local
PORT ?= 8080
CONDITION ?= baseline
TAIL ?= 120
DASHBOARD ?= phase2
RUN_WINDOW ?= auto
TABLE ?=
URI ?=
PARTS_DIR ?=
INPUT ?=
OUTPUT ?=

.PHONY: help env-check db-start server-start k6-run k6-evidence evidence-capture grafana-generate grafana-capture evidence-postprocess grafana-stitch phase-status k6-verify

help:
	@echo "Spring Concurrency Lab command interface"
	@echo
	@echo "Targets:"
	@echo "  make env-check"
	@echo "      필수 도구와 로컬 실행 환경을 확인한다."
	@echo "  make db-start PROFILE=local"
	@echo "      PostgreSQL, postgres_exporter, Prometheus, Grafana를 실행한다."
	@echo "  make server-start PROFILE=local PORT=8080"
	@echo "      Spring Boot 애플리케이션을 실행한다."
	@echo "  make k6-run PRESET=baseline MODE=prometheus"
	@echo "      k6 preset을 실행한다."
	@echo "  make k6-evidence PHASE=02-no-lock-baseline PRESET=baseline MODE=prometheus CONDITION=baseline"
	@echo "      evidence 파일명을 CONDITION 기반 run id로 남기며 k6를 실행한다."
	@echo "  make evidence-capture PHASE=02-no-lock-baseline PRESET=baseline CONDITION=baseline"
	@echo "      k6 evidence 실행 후 Grafana 캡처와 이미지 stitch를 수행한다."
	@echo "  make grafana-generate"
	@echo "      Grafana dashboard JSON을 생성한다."
	@echo "  make grafana-capture DASHBOARD=phase2 RUN_WINDOW=auto TABLE=concert"
	@echo "      Grafana dashboard를 viewport part 이미지로 캡처한다."
	@echo "  make evidence-postprocess PHASE=02-no-lock-baseline"
	@echo "      Grafana part 이미지를 stitched-dashboard.png로 합친다."
	@echo "  make phase-status PHASE=02-no-lock-baseline"
	@echo "      phase 문서와 evidence 위치를 확인한다."
	@echo "  make k6-verify"
	@echo "      k6 reservation response expectation을 검증한다."
	@echo
	@echo "Common variables and defaults:"
	@echo "  PHASE=$(PHASE)"
	@echo "  GRAFANA_PHASE=$(GRAFANA_PHASE)"
	@echo "  SCENARIO=$(SCENARIO)"
	@echo "  PRESET=$(PRESET)"
	@echo "  MODE=$(MODE)"
	@echo "  POOL=$(POOL)"
	@echo "  PROFILE=$(PROFILE)"
	@echo "  PORT=$(PORT)"
	@echo "  CONDITION=$(CONDITION)"
	@echo "  TAIL=$(TAIL)"
	@echo "  DASHBOARD=$(DASHBOARD)"
	@echo
	@echo "Default output locations:"
	@echo "  k6 summary/logs: docs/evidence/<phase>/k6, docs/evidence/<phase>/logs"
	@echo "  Grafana run window/parts: docs/evidence/<phase>/grafana"
	@echo "  Stitched dashboard: docs/evidence/<phase>/grafana/stitched-dashboard.png"

env-check:
	@command -v bash >/dev/null || { echo "missing: bash"; exit 1; }
	@command -v docker >/dev/null || { echo "missing: docker"; exit 1; }
	@docker compose version >/dev/null || { echo "missing: docker compose"; exit 1; }
	@command -v node >/dev/null || { echo "missing: node"; exit 1; }
	@command -v npm >/dev/null || { echo "missing: npm"; exit 1; }
	@command -v java >/dev/null || { echo "missing: java"; exit 1; }
	@command -v python3 >/dev/null || command -v python >/dev/null || { echo "missing: python3 or python"; exit 1; }
	@test -f concurrency/gradlew || { echo "missing: concurrency/gradlew"; exit 1; }
	@echo "env-check ok"

db-start:
	docker compose up -d postgres postgres_exporter prometheus grafana

server-start:
	cd concurrency && SPRING_PROFILES_ACTIVE=$(PROFILE) SERVER_PORT=$(PORT) bash ./gradlew bootRun

k6-run:
	K6_TAIL_LINES=$(TAIL) bash k6/run.sh $(PRESET) $(MODE)

k6-evidence:
	K6_EVIDENCE_PHASE_DIR=$(PHASE) K6_TAIL_LINES=$(TAIL) K6_RUN_ID="$(CONDITION)-$$(date +%Y%m%d-%H%M%S)" bash k6/run.sh $(PRESET) $(MODE)

evidence-capture:
	$(MAKE) k6-evidence PHASE=$(PHASE) PRESET=$(PRESET) MODE=$(MODE) CONDITION=$(CONDITION) TAIL=$(TAIL)
	$(MAKE) grafana-capture PHASE=$(PHASE) GRAFANA_PHASE=$(GRAFANA_PHASE) SCENARIO=$(SCENARIO) PRESET=$(PRESET) POOL=$(POOL) RUN_WINDOW=$(RUN_WINDOW) TABLE=$(TABLE)
	$(MAKE) evidence-postprocess PHASE=$(PHASE) OUTPUT=$(OUTPUT)

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

evidence-postprocess:
	python3 scripts/stitch-grafana-captures.py \
		--phase $(PHASE) \
		$(if $(INPUT),--input-dir $(INPUT),) \
		$(if $(OUTPUT),--output $(OUTPUT),)

grafana-stitch: evidence-postprocess

phase-status:
	@echo "Phase docs:"
	@test -d docs/phases/$(PHASE) && find docs/phases/$(PHASE) -maxdepth 1 -type f | sort || echo "missing: docs/phases/$(PHASE)"
	@echo
	@echo "Evidence:"
	@test -d docs/evidence/$(PHASE) && find docs/evidence/$(PHASE) -maxdepth 2 | sort || echo "missing: docs/evidence/$(PHASE)"

k6-verify:
	npm run k6:verify-reservation-responses
