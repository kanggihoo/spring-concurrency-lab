.PHONY: evidence-capture evidence-postprocess grafana-stitch phase-status

evidence-capture:
	$(MAKE) k6-evidence PHASE=$(PHASE) K6_PRESET=$(K6_PRESET) MODE=$(MODE) CONDITION=$(CONDITION) TAIL=$(TAIL) POOL=$(POOL)
	$(MAKE) grafana-capture PHASE=$(PHASE) GRAFANA_PHASE=$(GRAFANA_PHASE) SCENARIO=$(SCENARIO) GRAFANA_PRESET=$(GRAFANA_PRESET) POOL=$(POOL) RUN_WINDOW=$(RUN_WINDOW) TABLE=$(TABLE) URI=$(URI) PARTS_DIR=$(PARTS_DIR)
	$(MAKE) evidence-postprocess PHASE=$(PHASE) OUTPUT=$(OUTPUT)

evidence-postprocess:
	$(PYTHON) scripts/stitch-grafana-captures.py \
		--phase $(PHASE) \
		$(if $(INPUT),--input-dir $(INPUT),) \
		$(if $(OUTPUT),--output $(OUTPUT),)

grafana-stitch: evidence-postprocess

phase-status:
	@echo "Phase docs:"
	@test -d docs/phases/$(PHASE) && find docs/phases/$(PHASE) -maxdepth 1 -type f | sort || echo "missing: docs/phases/$(PHASE)"
	@echo ""
	@echo "Evidence:"
	@test -d docs/evidence/$(PHASE) && find docs/evidence/$(PHASE) -maxdepth 2 | sort || echo "missing: docs/evidence/$(PHASE)"
