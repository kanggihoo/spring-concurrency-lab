# 000. Command Interface and Phase 4 Presets

### Task 000: Add Phase 4 Execution Support

**Files:**
- Modify: `Makefile`
- Modify: `k6/run.sh`
- Modify: `k6/reservation-test.js`
- Create: `k6/presets/phase4-atomic-pool.json`
- Create: `k6/presets/phase4-pessimistic-pool.json`
- Create: `k6/presets/phase4-pessimistic-timeout.json`
- Create: `scripts/sql/consistency-check.sql`

- [ ] **Step 1: Extend Makefile variables**

Modify the variable block near the top of `Makefile` to include:

```make
POOL_SIZE ?= 10
LOCK_TIMEOUT ?= 0
EXPERIMENT ?=
```

Expected behavior:

- `POOL_SIZE=10` matches the current Hikari default.
- `LOCK_TIMEOUT=0` means PostgreSQL default lock wait behavior.
- `EXPERIMENT` is used by generic SQL evidence targets.

- [ ] **Step 2: Extend `server-start` without creating Phase 4-only server targets**

Replace the existing `server-start` recipe with a recipe that validates numeric inputs and maps them to Spring Boot environment variables:

```make
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
```

- [ ] **Step 3: Pass `POOL` through Makefile k6 commands**

Modify `k6-run` and `k6-evidence` so `POOL` is available to `k6/run.sh`:

```make
k6-run:
	POOL=$(POOL) K6_TAIL_LINES=$(TAIL) bash k6/run.sh $(PRESET) $(MODE)

k6-evidence:
	POOL=$(POOL) K6_EVIDENCE_PHASE_DIR=$(PHASE) K6_TAIL_LINES=$(TAIL) K6_RUN_ID="$(CONDITION)-$$(date +%Y%m%d-%H%M%S)" bash k6/run.sh $(PRESET) $(MODE)
```

- [ ] **Step 4: Add generic consistency SQL target and Phase 4 alias**

Add these targets after `phase3-sql-consistencies`:

```make
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
```

Keep `phase3-sql-consistency` in place. It may use the new generic SQL file, but the Phase 3 target name remains available.

- [ ] **Step 5: Add the generic consistency query**

Create `scripts/sql/consistency-check.sql`:

```sql
SELECT
    c.id AS concert_id,
    100 AS initial_seat_count,
    COUNT(r.id) AS reservation_count,
    c.remaining_seats,
    COUNT(r.id) + c.remaining_seats - 100 AS seat_count_inconsistency,
    COUNT(r.id) > 100 AS overbooked
FROM concert c
LEFT JOIN reservation r ON r.concert_id = c.id
WHERE c.id = 1
GROUP BY c.id, c.remaining_seats;
```

- [ ] **Step 6: Let k6 runner use the effective pool label**

In `k6/run.sh`, calculate `K6_POOL` after reading `PRESET_POOL`:

```bash
if [[ -n "${POOL:-}" && "$POOL" != "default" ]]; then
  K6_POOL="$POOL"
else
  K6_POOL="$PRESET_POOL"
fi
```

Use `K6_POOL` in:

- preset validation
- all `k6 run` commands as `-e POOL="$K6_POOL"`
- run-window JSON `"pool"` field

- [ ] **Step 7: Let k6 script override preset pool labels**

In `k6/reservation-test.js`, change:

```javascript
const pool = requiredString("pool");
```

to:

```javascript
const pool = __ENV.POOL || requiredString("pool");
```

- [ ] **Step 8: Add the Atomic Phase 4 preset**

Create `k6/presets/phase4-atomic-pool.json`:

```json
{
  "phase": "phase-04",
  "evidenceDir": "04-db-operational-limits/atomic-pool",
  "scenario": "atomic",
  "preset": "pool-limit",
  "pool": "10",
  "path": "/api/reservations/atomic",
  "executor": "constant-vus",
  "vus": 100,
  "duration": "10s",
  "thresholds": {
    "http_req_failed": ["rate<0.01"],
    "http_req_duration": ["p(95)<1000"]
  },
  "resetBeforeRun": true,
  "captureConsistency": true
}
```

- [ ] **Step 9: Add the Pessimistic pool preset**

Create `k6/presets/phase4-pessimistic-pool.json`:

```json
{
  "phase": "phase-04",
  "evidenceDir": "04-db-operational-limits/pessimistic-pool",
  "scenario": "pessimistic",
  "preset": "pool-lock-wait",
  "pool": "10",
  "path": "/api/reservations/pessimistic",
  "executor": "constant-vus",
  "vus": 100,
  "duration": "10s",
  "thresholds": {
    "http_req_failed": ["rate<0.01"],
    "http_req_duration": ["p(95)<1000"]
  },
  "resetBeforeRun": true,
  "captureConsistency": true
}
```

- [ ] **Step 10: Add the Pessimistic timeout preset**

Create `k6/presets/phase4-pessimistic-timeout.json`:

```json
{
  "phase": "phase-04",
  "evidenceDir": "04-db-operational-limits/pessimistic-timeout",
  "scenario": "pessimistic",
  "preset": "lock-timeout",
  "pool": "10",
  "path": "/api/reservations/pessimistic",
  "executor": "constant-vus",
  "vus": 100,
  "duration": "10s",
  "thresholds": {
    "http_req_failed": ["rate<0.01"],
    "http_req_duration": ["p(95)<1000"]
  },
  "resetBeforeRun": true,
  "captureConsistency": true
}
```

- [ ] **Step 11: Verify command support without running load tests**

Run:

```powershell
git diff --check
```

Expected: exit code `0`.

Run:

```powershell
node -e "const fs=require('fs'); for (const f of fs.readdirSync('k6/presets').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('k6/presets/'+f,'utf8')); console.log('json ok')"
```

Expected output:

```text
json ok
```

Run:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' -n 'k6/run.sh'
```

Expected: exit code `0`.

Run:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' -lc 'make -n server-start POOL_SIZE=2 LOCK_TIMEOUT=500'
```

Expected dry-run output includes:

```text
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE="$pool_size"
SPRING_DATASOURCE_HIKARI_CONNECTION_INIT_SQL="SET lock_timeout = '${lock_timeout}ms'"
```

- [ ] **Step 12: Commit**

```powershell
git add Makefile `
        k6/run.sh `
        k6/reservation-test.js `
        k6/presets/phase4-atomic-pool.json `
        k6/presets/phase4-pessimistic-pool.json `
        k6/presets/phase4-pessimistic-timeout.json `
        scripts/sql/consistency-check.sql
git commit -m "chore: add phase4 operational limit commands"
```
