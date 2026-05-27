# 004. k6, Makefile, and Evidence Layout

### Task 004: Add Phase 5 Load Presets and Evidence Commands

**Files:**
- Create: `k6/presets/phase5-redisson-lock.json`
- Create: `k6/presets/phase5-redis-lua.json`
- Create: `k6/presets/phase5-atomic-baseline.json`
- Modify: `k6/reservation-test.js`
- Modify: `Makefile`
- Modify: `docs/phases/05-redis-strategies/runbook.md`
- Modify: `docs/phases/05-redis-strategies/observability.md`

- [ ] **Step 1: Add Redisson k6 preset**

Create `k6/presets/phase5-redisson-lock.json`:

```json
{
  "phase": "phase-05",
  "evidenceDir": "05-redis-strategies/redisson-lock",
  "scenario": "redisson",
  "preset": "baseline",
  "pool": "10",
  "path": "/api/reservations/redisson",
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

- [ ] **Step 2: Add Redis Lua k6 preset**

Create `k6/presets/phase5-redis-lua.json`:

```json
{
  "phase": "phase-05",
  "evidenceDir": "05-redis-strategies/redis-lua",
  "scenario": "redis-lua",
  "preset": "baseline",
  "pool": "10",
  "path": "/api/reservations/redis-lua",
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

- [ ] **Step 3: Add Phase 5 Atomic baseline preset**

Create `k6/presets/phase5-atomic-baseline.json`:

```json
{
  "phase": "phase-05",
  "evidenceDir": "05-redis-strategies/atomic-baseline",
  "scenario": "atomic",
  "preset": "baseline",
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

- [ ] **Step 4: Classify Phase 5 response bodies in k6**

Modify `k6/reservation-test.js` so expected statuses include 500 for explicit Redis/DB sync failure only when it appears during non-performance checks:

```javascript
const reservationResponseCallback = http.expectedStatuses(200, 409, 500);
```

Add body status classification metrics near the existing gauges:

```javascript
import { Counter, Gauge } from "k6/metrics";

const reservedResponses = new Counter("reservation_status_reserved");
const soldOutResponses = new Counter("reservation_status_sold_out");
const lockAcquireFailedResponses = new Counter("reservation_status_lock_acquire_failed");
const redisDbSyncFailedResponses = new Counter("reservation_status_redis_db_sync_failed");
```

After the POST call, parse the status:

```javascript
let responseStatus = "";
try {
  responseStatus = res.json("status") || "";
} catch (error) {
  responseStatus = "";
}

if (responseStatus === "reserved") {
  reservedResponses.add(1);
} else if (responseStatus === "sold_out") {
  soldOutResponses.add(1);
} else if (responseStatus === "lock_acquire_failed") {
  lockAcquireFailedResponses.add(1);
} else if (responseStatus === "redis_db_sync_failed") {
  redisDbSyncFailedResponses.add(1);
}
```

Change the check:

```javascript
check(res, {
  "status 200, 409, or expected redis failure": (r) => r.status === 200 || r.status === 409 || r.status === 500,
});
```

- [ ] **Step 5: Add Makefile Phase 5 evidence helpers**

Add variables near the top of `Makefile`:

```make
REDIS_KEY ?= concert:1:remaining-seats
```

Add targets after `phase4-sql-consistency`:

```make
phase5-sql-consistency:
	$(MAKE) sql-consistency PHASE=05-redis-strategies EXPERIMENT=$(EXPERIMENT) CONDITION=$(CONDITION)

phase5-redis-snapshot:
	@test -n "$(EXPERIMENT)" || { echo "EXPERIMENT is required."; exit 1; }
	@test -n "$(CONDITION)" || { echo "CONDITION is required."; exit 1; }
	@mkdir -p "docs/evidence/05-redis-strategies/$(EXPERIMENT)/$(CONDITION)/redis"
	docker compose exec -T redis redis-cli GET "$(REDIS_KEY)" \
		> "docs/evidence/05-redis-strategies/$(EXPERIMENT)/$(CONDITION)/redis/remaining-seats.txt"
```

- [ ] **Step 6: Update Phase 5 docs with exact command names**

In `docs/phases/05-redis-strategies/runbook.md`, add command examples:

````markdown
## Evidence Commands

```bash
make k6-evidence PHASE=05-redis-strategies PRESET=phase5-redisson-lock MODE=prometheus CONDITION=baseline
make phase5-sql-consistency EXPERIMENT=redisson-lock CONDITION=baseline
make phase5-redis-snapshot EXPERIMENT=redisson-lock CONDITION=baseline

make k6-evidence PHASE=05-redis-strategies PRESET=phase5-redis-lua MODE=prometheus CONDITION=baseline
make phase5-sql-consistency EXPERIMENT=redis-lua CONDITION=baseline
make phase5-redis-snapshot EXPERIMENT=redis-lua CONDITION=baseline
```
````

In `docs/phases/05-redis-strategies/observability.md`, add the k6 status counters:

```markdown
| k6 | `reservation_status_reserved` | reserved 응답 수 |
| k6 | `reservation_status_sold_out` | sold-out 응답 수 |
| k6 | `reservation_status_lock_acquire_failed` | Redisson lock 획득 실패 수 |
| k6 | `reservation_status_redis_db_sync_failed` | Redis 차감 후 DB 처리 실패 수 |
```

- [ ] **Step 7: Verify JSON, JavaScript, and Makefile syntax**

Run:

```bash
rtk proxy node -e "const fs=require('fs'); for (const f of fs.readdirSync('k6/presets').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('k6/presets/'+f,'utf8')); console.log('json ok')"
```

Expected:

```text
json ok
```

Run:

```bash
rtk proxy bash -n k6/run.sh
```

Expected: exit code `0`.

Run:

```bash
rtk proxy make -n phase5-redis-snapshot EXPERIMENT=redis-lua CONDITION=baseline
```

Expected: dry-run output writes to `docs/evidence/05-redis-strategies/redis-lua/baseline/redis/remaining-seats.txt`.

- [ ] **Step 8: Commit**

```bash
git add k6/presets/phase5-redisson-lock.json \
        k6/presets/phase5-redis-lua.json \
        k6/presets/phase5-atomic-baseline.json \
        k6/reservation-test.js \
        Makefile \
        docs/phases/05-redis-strategies/runbook.md \
        docs/phases/05-redis-strategies/observability.md
git commit -m "chore: add phase5 redis load evidence commands"
```
