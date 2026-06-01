.PHONY: phase3-grafana-capture phase3-grafana-captures phase3-grafana-stitch phase3-grafana-stitches phase3-sql-consistency phase3-sql-consistencies phase4-sql-consistency

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

phase3-grafana-captures:
	$(MAKE) phase3-grafana-capture STRATEGY=pessimistic-lock MODE=$(MODE) POOL=$(POOL)
	$(MAKE) phase3-grafana-capture STRATEGY=optimistic-lock MODE=$(MODE) POOL=$(POOL)
	$(MAKE) phase3-grafana-capture STRATEGY=atomic-update MODE=$(MODE) POOL=$(POOL)

phase3-grafana-stitch:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock|optimistic-lock|atomic-update) ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	$(MAKE) evidence-postprocess PHASE=03-db-strategies/$$strategy

phase3-grafana-stitches:
	$(MAKE) phase3-grafana-stitch STRATEGY=pessimistic-lock
	$(MAKE) phase3-grafana-stitch STRATEGY=optimistic-lock
	$(MAKE) phase3-grafana-stitch STRATEGY=atomic-update

phase3-sql-consistency:
	@strategy="$(STRATEGY)"; \
	case "$$strategy" in \
		pessimistic-lock|optimistic-lock|atomic-update) ;; \
		*) echo "Unknown STRATEGY=$$strategy. Expected pessimistic-lock, optimistic-lock, or atomic-update."; exit 1 ;; \
	esac; \
	$(MAKE) sql-consistency \
		PHASE=03-db-strategies/$$strategy \
		SQL_OUTPUT=docs/evidence/03-db-strategies/$$strategy/sql/baseline-consistency.txt

phase3-sql-consistencies:
	$(MAKE) phase3-sql-consistency STRATEGY=pessimistic-lock
	$(MAKE) phase3-sql-consistency STRATEGY=optimistic-lock
	$(MAKE) phase3-sql-consistency STRATEGY=atomic-update

phase4-sql-consistency:
	$(MAKE) sql-consistency PHASE=04-db-operational-limits EXPERIMENT=$(EXPERIMENT) CONDITION=$(CONDITION)
