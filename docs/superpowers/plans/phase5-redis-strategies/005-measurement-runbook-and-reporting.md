# 005. Measurement Runbook and Reporting

### Task 005: Run Phase 5 Measurements and Complete Report

**Files:**
- Modify: `docs/phases/05-redis-strategies/report.md`
- Add evidence under: `docs/evidence/05-redis-strategies/atomic-baseline/`
- Add evidence under: `docs/evidence/05-redis-strategies/redisson-lock/`
- Add evidence under: `docs/evidence/05-redis-strategies/redis-lua/`

- [ ] **Step 1: Start observability services**

Run:

```bash
rtk proxy docker compose up -d postgres postgres_exporter redis redis_exporter prometheus grafana
```

Expected:

```text
Container postgres  Running
Container redis  Running
Container postgres_exporter  Running
Container redis_exporter  Running
Container prometheus  Running
Container grafana  Running
```

- [ ] **Step 2: Start server for Atomic pool 10 baseline**

Run in a long-running terminal:

```bash
rtk proxy make server-start PROFILE=local PORT=8080 POOL_SIZE=10
```

Expected: Spring Boot starts and Actuator is available at `http://localhost:8080/actuator/prometheus`.

- [ ] **Step 3: Capture Atomic pool 10 baseline**

Run:

```bash
rtk proxy make k6-evidence PHASE=05-redis-strategies PRESET=phase5-atomic-baseline MODE=prometheus CONDITION=atomic-pool-10 POOL=10
rtk proxy make phase5-sql-consistency EXPERIMENT=atomic-baseline CONDITION=atomic-pool-10
```

Expected:

- k6 summary is saved under `docs/evidence/05-redis-strategies/atomic-baseline/k6/`.
- SQL consistency is saved under `docs/evidence/05-redis-strategies/atomic-baseline/atomic-pool-10/sql/consistency.txt`.
- SQL shows Reservation 100, Remaining Seats 0, Seat Count Inconsistency 0, Overbooking false.

- [ ] **Step 4: Restart server for Atomic pool 50 baseline**

Stop the previous server and run:

```bash
rtk proxy make server-start PROFILE=local PORT=8080 POOL_SIZE=50
```

Then run:

```bash
rtk proxy make k6-evidence PHASE=05-redis-strategies PRESET=phase5-atomic-baseline MODE=prometheus CONDITION=atomic-pool-50 POOL=50
rtk proxy make phase5-sql-consistency EXPERIMENT=atomic-baseline CONDITION=atomic-pool-50
```

Expected: same final consistency as pool 10.

- [ ] **Step 5: Restart server for Redisson baseline**

Stop the previous server and run:

```bash
rtk proxy make server-start PROFILE=local PORT=8080 POOL_SIZE=10
```

Then run:

```bash
rtk proxy make k6-evidence PHASE=05-redis-strategies PRESET=phase5-redisson-lock MODE=prometheus CONDITION=baseline POOL=10
rtk proxy make phase5-sql-consistency EXPERIMENT=redisson-lock CONDITION=baseline
rtk proxy make phase5-redis-snapshot EXPERIMENT=redisson-lock CONDITION=baseline
```

Expected:

- DB consistency remains valid.
- Redis Remaining Seats snapshot may be `100` or empty if Redisson only uses Redis for locks. Record the observed value in the report.
- k6 status counters include `reservation_status_lock_acquire_failed` when lock contention exceeds wait time.

- [ ] **Step 6: Capture Redis Lua baseline**

Run:

```bash
rtk proxy make k6-evidence PHASE=05-redis-strategies PRESET=phase5-redis-lua MODE=prometheus CONDITION=baseline POOL=10
rtk proxy make phase5-sql-consistency EXPERIMENT=redis-lua CONDITION=baseline
rtk proxy make phase5-redis-snapshot EXPERIMENT=redis-lua CONDITION=baseline
```

Expected:

- DB consistency remains valid.
- Redis Remaining Seats snapshot is `0`.
- k6 status counters show reserved and sold_out responses for normal load.
- `reservation_status_redis_db_sync_failed` remains `0` during normal k6 performance runs.

- [ ] **Step 7: Run full automated tests**

Run:

```bash
rtk gradlew -p concurrency test
```

Expected: all tests pass.

- [ ] **Step 8: Fill report tables from measured evidence**

Modify `docs/phases/05-redis-strategies/report.md`.

Fill `Strategy Comparison` from k6 summary JSON and Prometheus p99 query evidence. The committed table must contain numeric values with units for every measured RPS, p95, p99, and Error Rate cell. Use relative links to the exact evidence files that produced each value.

Use this command to print the latest k6 summary files before editing the table:

```bash
rtk proxy node - <<'NODE'
const fs = require('fs');
const path = require('path');
const roots = [
  ['Atomic Conditional Update pool 10', 'docs/evidence/05-redis-strategies/atomic-baseline/k6'],
  ['Atomic Conditional Update pool 50', 'docs/evidence/05-redis-strategies/atomic-baseline/k6'],
  ['Redisson Lock', 'docs/evidence/05-redis-strategies/redisson-lock/k6'],
  ['Redis Lua Atomic Decrement', 'docs/evidence/05-redis-strategies/redis-lua/k6'],
];
for (const [name, dir] of roots) {
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((file) => file.endsWith('-summary.json')).sort()
    : [];
  const latest = files.at(-1);
  if (!latest) {
    console.log(`${name}: missing summary`);
    continue;
  }
  const fullPath = path.join(dir, latest);
  const summary = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const rps = summary.metrics.http_reqs.rate.toFixed(2);
  const p95 = summary.metrics.http_req_duration.percentiles['p(95)'].toFixed(2) + ' ms';
  const errorRate = (summary.metrics.http_req_failed.rate * 100).toFixed(2) + '%';
  console.log(`${name}: RPS=${rps}, p95=${p95}, errorRate=${errorRate}, file=${fullPath}`);
}
NODE
```

Use Prometheus or existing run-window p99 evidence for the p99 cells. If Phase 5 reuses Phase 4 Atomic baseline values instead of rerunning Atomic, state that explicitly in `Evidence Notes` and link to the Phase 4 evidence.

- [ ] **Step 9: Fill consistency and compensation results**

In `docs/phases/05-redis-strategies/report.md`, fill:

```markdown
## Compensation Result

| Scenario | Result | Evidence |
|---|---|---|
| Redis decrement success, DB save failure | PASS | `RedisLuaCompensationTest` |
```

Fill `Consistency Result` with measured DB and Redis values:

```markdown
| Strategy | Reservation Count | Remaining Seats | Seat Count Inconsistency | Overbooking | Redis Remaining Seats |
|---|---:|---:|---:|---|---|
| Atomic Conditional Update pool 10 | 100 | 0 | 0 | false | N/A |
| Atomic Conditional Update pool 50 | 100 | 0 | 0 | false | N/A |
| Redisson Lock | 100 | 0 | 0 | false | <observed> |
| Redis Lua Atomic Decrement | 100 | 0 | 0 | false | 0 |
```

- [ ] **Step 10: Write operating decision**

In `docs/phases/05-redis-strategies/report.md`, fill `Findings` and `Decision` using this decision frame:

```markdown
## Findings

- Redisson Lock adds Redis lock acquire/release overhead and can fail fast under high contention.
- Redis Lua can reject sold-out requests before DB work, but it introduces Redis-DB compensation complexity.
- Atomic Conditional Update remains the simplest DB-only baseline and should remain the default unless Redis shows clear DB pressure reduction or latency improvement.

## Decision

Keep DB Atomic Conditional Update as the default counted-seat Reservation strategy when the flow is a single-row Remaining Seats decrement plus Reservation insert. Treat Redisson Lock and Redis Lua as situational strategies that require stronger operational justification, Redis observability, and compensation monitoring.
```

Revise the wording to match measured results, but keep the decision tied to evidence.

- [ ] **Step 11: Verify report and docs**

Run:

```bash
rtk git diff --check
rtk proxy find docs/evidence/05-redis-strategies -maxdepth 4 -type f | sort
```

Expected:

- `git diff --check` exits `0`.
- Evidence tree contains k6 summaries, SQL consistency files, and Redis snapshots for Redis strategies.

- [ ] **Step 12: Commit**

```bash
git add docs/phases/05-redis-strategies/report.md \
        docs/evidence/05-redis-strategies
git commit -m "docs: record phase5 redis strategy results"
```
