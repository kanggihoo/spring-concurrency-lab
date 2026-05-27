# 004. Pessimistic Timeout Matrix

### Task 004: Run Pessimistic Lock Timeout Matrix

**Files:**
- Generate evidence: `docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/`
- Generate evidence: `docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/`
- Generate evidence: `docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/`
- Update later: `docs/phases/04-db-operational-limits/report.md`

- [ ] **Step 1: Start shared infrastructure**

Run:

```powershell
make db-start
```

Expected: PostgreSQL, exporter, Prometheus, and Grafana are running.

- [ ] **Step 2: Run timeout-200**

Restart server:

```powershell
make server-start POOL_SIZE=10 LOCK_TIMEOUT=200
```

Run:

```powershell
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-200 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-200
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-200
```

Expected:

- k6 treats `200` and `409` as expected statuses.
- Requests that hit PostgreSQL lock timeout should return `408 lock_timeout` from the API.
- Consistency SQL shows `seat_count_inconsistency` as `0` and `overbooked` as `f`.

- [ ] **Step 3: Run timeout-500**

Restart server:

```powershell
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
```

Run:

```powershell
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-500 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-500
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-500
```

- [ ] **Step 4: Run timeout-1000**

Restart server:

```powershell
make server-start POOL_SIZE=10 LOCK_TIMEOUT=1000
```

Run:

```powershell
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-1000 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-1000
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-1000
```

- [ ] **Step 5: Capture timeout-500 Grafana dashboard**

Find the latest timeout-500 run-window and pass it through a PowerShell variable:

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
make grafana-capture DASHBOARD=overview GRAFANA_PHASE=phase-04 SCENARIO=pessimistic PRESET=lock-timeout POOL=10 RUN_WINDOW="$runWindow" PARTS_DIR=docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/grafana/parts
make evidence-postprocess PHASE=04-db-operational-limits/pessimistic-timeout/timeout-500 OUTPUT=docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/grafana/stitched-dashboard.png
```

- [ ] **Step 6: Verify timeout evidence**

Run:

```powershell
make phase-status PHASE=04-db-operational-limits/pessimistic-timeout
```

Expected: `timeout-200`, `timeout-500`, and `timeout-1000` directories exist.

Run:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-timeout -Recurse -Filter consistency.txt | Select-String "seat_count_inconsistency|overbooked"
```

Expected: all three consistency files include both columns.

- [ ] **Step 7: Commit**

```powershell
git add docs/evidence/04-db-operational-limits/pessimistic-timeout
git commit -m "docs: record phase4 pessimistic timeout evidence"
```
