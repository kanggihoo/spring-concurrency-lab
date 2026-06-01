.PHONY: server-start

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
		SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/reservation?options=-c%20lock_timeout%3D$${lock_timeout}ms" \
		bash ./gradlew bootRun; \
	fi
