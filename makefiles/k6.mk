.PHONY: k6-run k6-evidence k6-verify

k6-run:
	POOL=$(POOL) K6_TAIL_LINES=$(TAIL) bash k6/run.sh $(K6_PRESET) $(MODE)

k6-evidence:
	POOL=$(POOL) K6_EVIDENCE_PHASE_DIR=$(PHASE) K6_TAIL_LINES=$(TAIL) K6_RUN_ID="$(CONDITION)-$$(date +%Y%m%d-%H%M%S)" bash k6/run.sh $(K6_PRESET) $(MODE)

k6-verify:
	npm run k6:verify-reservation-responses
