SHELL := C:/PROGRA~1/Git/bin/bash.exe
.DEFAULT_GOAL := help

PHASE ?= 02-no-lock-baseline
GRAFANA_PHASE ?= phase-02
SCENARIO ?= no-lock
PRESET ?= baseline
MODE ?= prometheus
POOL ?= default
POOL_SIZE ?= 10
LOCK_TIMEOUT ?= 0
PROFILE ?= local
PORT ?= 8080
CONDITION ?= baseline
TAIL ?= 120
PYTHON ?= python.exe
DASHBOARD ?= phase2
RUN_WINDOW ?= auto
STRATEGY ?= pessimistic-lock
TABLE ?=
URI ?=
PARTS_DIR ?=
INPUT ?=
OUTPUT ?=
EXPERIMENT ?=

.PHONY: help env-check db-start server-start k6-run k6-evidence evidence-capture grafana-generate grafana-capture phase3-grafana-capture phase3-grafana-captures phase3-grafana-stitch phase3-grafana-stitches sql-consistency phase3-sql-consistency phase3-sql-consistencies phase4-sql-consistency evidence-postprocess grafana-stitch phase-status k6-verify

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
	@echo "  make server-start POOL_SIZE=10 LOCK_TIMEOUT=500"
	@echo "      HikariCP pool size와 PostgreSQL lock_timeout(ms)을 지정해 실행한다."
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
	@echo "  make phase3-grafana-capture STRATEGY=pessimistic-lock"
	@echo "      Capture a Phase 3 strategy overview dashboard using its latest run-window."
	@echo "  make phase3-grafana-captures"
	@echo "      Capture all Phase 3 strategy overview dashboards."
	@echo "  make phase3-grafana-stitch STRATEGY=pessimistic-lock"
	@echo "      Stitch a Phase 3 strategy overview dashboard capture."
	@echo "  make phase3-grafana-stitches"
	@echo "      Stitch all Phase 3 strategy overview dashboard captures."
	@echo "  make phase3-sql-consistency STRATEGY=pessimistic-lock"
	@echo "      Save Phase 3 SQL consistency evidence for one strategy."
	@echo "  make phase3-sql-consistencies"
	@echo "      Save Phase 3 SQL consistency evidence for all strategies."
	@echo "  make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10"
	@echo "      Save Phase 4 SQL consistency evidence for one experiment condition."
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
	@echo "  POOL_SIZE=$(POOL_SIZE)"
	@echo "  LOCK_TIMEOUT=$(LOCK_TIMEOUT)"
	@echo "  PROFILE=$(PROFILE)"
	@echo "  PORT=$(PORT)"
	@echo "  CONDITION=$(CONDITION)"
	@echo "  TAIL=$(TAIL)"
	@echo "  PYTHON=$(PYTHON)"
	@echo "  DASHBOARD=$(DASHBOARD)"
	@echo "  STRATEGY=$(STRATEGY)"
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
	@command -v $(PYTHON) >/dev/null || { echo "missing: $(PYTHON)"; exit 1; }
	@test -f concurrency/gradlew || { echo "missing: concurrency/gradlew"; exit 1; }
	@echo "env-check ok"

db-start:
	docker compose up -d postgres postgres_exporter prometheus grafana

server-start:
	@pool_size="$(POOL_SIZE)"; \
	lock_timeout="$(LOCK_TIMEOUT)"; \
	case "$$pool_size" in ''|*[!0-9]*) echo "POOL_SIZE must be a positive integer. Got: $$pool_size"; exit 1 ;; esac; \
	if [[ "$$pool_size" -eq 0 ]]; then echo "POOL_SIZE must be greater than 0."; exit 1; fi; \
	case "$$lock_timeout" in ''|*[!0-9]*) echo "LOCK_TIMEOUT must be numeric milliseconds or 0. Got: $$lock_timeout"; exit 1 ;; esac; \
	cd concurrency && \
	if [[ "$$lock_timeout" -eq 0 ]]; then \
		SPRING_PROFILES_ACTIVE=$(PROFILE) \
		SERVER_PORT=$(PORT) \
		SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE="$$pool_size" \
		bash ./gradlew bootRun; \
	else \
		SPRING_PROFILES_ACTIVE=$(PROFILE) \
		SERVER_PORT=$(PORT) \
		SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE="$$pool_size" \
		SPRING_DATASOURCE_HIKARI_CONNECTION_INIT_SQL="SET lock_timeout = '$${lock_timeout}ms'" \
		bash ./gradlew bootRun; \
	fi

k6-run:
	POOL=$(POOL) K6_TAIL_LINES=$(TAIL) bash k6/run.sh $(PRESET) $(MODE)

k6-evidence:
	POOL=$(POOL) K6_EVIDENCE_PHASE_DIR=$(PHASE) K6_TAIL_LINES=$(TAIL) K6_RUN_ID="$(CONDITION)-$$(date +%Y%m%d-%H%M%S)" bash k6/run.sh $(PRESET) $(MODE)

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

phase3-grafana-capture:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock) scenario="pessimistic"; preset_name="phase3-pessimistic-baseline" ;; \
		optimistic-lock) scenario="optimistic"; preset_name="phase3-optimistic-baseline" ;; \
		atomic-update) scenario="atomic"; preset_name="phase3-atomic-baseline" ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	run_window=$$(ls -t docs/evidence/03-db-strategies/$$strategy/grafana/run-window-$$preset_name-$(MODE)-*.json 2>/dev/null | head -n 1); \
	if [[ -z "$$run_window" ]]; then \
		echo "No Phase 3 run-window found for $$strategy. Run: make k6-run PRESET=$$preset_name MODE=$(MODE)"; \
		exit 1; \
	fi; \
	npm run grafana:capture -- \
		--dashboard overview \
		--phase phase-03 \
		--scenario "$$scenario" \
		--preset baseline \
		--pool $(POOL) \
		--run-window "$$run_window" \
		--parts-dir "docs/evidence/03-db-strategies/$$strategy/grafana/parts"

phase3-grafana-captures:
	make phase3-grafana-capture STRATEGY=pessimistic-lock MODE=$(MODE) POOL=$(POOL)
	make phase3-grafana-capture STRATEGY=optimistic-lock MODE=$(MODE) POOL=$(POOL)
	make phase3-grafana-capture STRATEGY=atomic-update MODE=$(MODE) POOL=$(POOL)

phase3-grafana-stitch:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock|optimistic-lock|atomic-update) ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	$(PYTHON) scripts/stitch-grafana-captures.py \
		--input-dir "docs/evidence/03-db-strategies/$$strategy/grafana/parts" \
		--output "docs/evidence/03-db-strategies/$$strategy/grafana/stitched-dashboard.png"

phase3-grafana-stitches:
	make phase3-grafana-stitch STRATEGY=pessimistic-lock
	make phase3-grafana-stitch STRATEGY=optimistic-lock
	make phase3-grafana-stitch STRATEGY=atomic-update

phase3-sql-consistency:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock|optimistic-lock|atomic-update) ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	mkdir -p "docs/evidence/03-db-strategies/$$strategy/sql"; \
	docker compose exec -T postgres psql -U user -d reservation \
		< scripts/sql/consistency-check.sql \
		> "docs/evidence/03-db-strategies/$$strategy/sql/baseline-consistency.txt"

phase3-sql-consistencies:
	make phase3-sql-consistency STRATEGY=pessimistic-lock
	make phase3-sql-consistency STRATEGY=optimistic-lock
	make phase3-sql-consistency STRATEGY=atomic-update

sql-consistency:
	@test -n "$(PHASE)" || { echo "PHASE is required."; exit 1; }
	@test -n "$(EXPERIMENT)" || { echo "EXPERIMENT is required."; exit 1; }
	@test -n "$(CONDITION)" || { echo "CONDITION is required."; exit 1; }
	@mkdir -p "docs/evidence/$(PHASE)/$(EXPERIMENT)/$(CONDITION)/sql"
	docker compose exec -T postgres psql -U user -d reservation \
		< scripts/sql/consistency-check.sql \
		> "docs/evidence/$(PHASE)/$(EXPERIMENT)/$(CONDITION)/sql/consistency.txt"

phase4-sql-consistency:
	$(MAKE) sql-consistency PHASE=04-db-operational-limits EXPERIMENT=$(EXPERIMENT) CONDITION=$(CONDITION)

evidence-postprocess:
	$(PYTHON) scripts/stitch-grafana-captures.py \
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
