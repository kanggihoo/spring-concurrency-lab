.PHONY: sql-consistency

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
