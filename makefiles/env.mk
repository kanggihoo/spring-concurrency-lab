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
