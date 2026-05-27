# 002. Atomic Pool Matrix

### Task 002: Run Atomic Conditional Update Pool Matrix

**Files:**
- Generate evidence: `docs/evidence/04-db-operational-limits/atomic-pool/pool-2/`
- Generate evidence: `docs/evidence/04-db-operational-limits/atomic-pool/pool-5/`
- Generate evidence: `docs/evidence/04-db-operational-limits/atomic-pool/pool-10/`
- Generate evidence: `docs/evidence/04-db-operational-limits/atomic-pool/pool-20/`
- Generate evidence: `docs/evidence/04-db-operational-limits/atomic-pool/pool-50/`
- Update later: `docs/phases/04-db-operational-limits/report.md`

- [ ] **Step 1: Start shared infrastructure**

Run:

```powershell
make db-start
```

Expected: Docker Compose starts or reuses `postgres`, `postgres_exporter`, `prometheus`, and `grafana`.

- [ ] **Step 2: Run pool-2**

Start server in one terminal:

```powershell
make server-start POOL_SIZE=2
```

Verify pool size in another terminal:

```powershell
curl http://localhost:8080/actuator/prometheus | Select-String "hikaricp_connections_max"
```

Expected output includes:

```text
hikaricp_connections_max{application="concurrency",pool="HikariPool-1"} 2.0
```

Run k6:

```powershell
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-2 PRESET=phase4-atomic-pool POOL=2 CONDITION=pool-2
```

Save SQL evidence:

```powershell
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-2
```

- [ ] **Step 3: Run pool-5**

Restart the server:

```powershell
make server-start POOL_SIZE=5
```

Verify:

```powershell
curl http://localhost:8080/actuator/prometheus | Select-String "hikaricp_connections_max"
```

Expected output includes `5.0`.

Run:

```powershell
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-5 PRESET=phase4-atomic-pool POOL=5 CONDITION=pool-5
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-5
```

- [ ] **Step 4: Run pool-10**

Restart the server:

```powershell
make server-start POOL_SIZE=10
```

Verify actuator output includes `10.0`, then run:

```powershell
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-10 PRESET=phase4-atomic-pool POOL=10 CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

- [ ] **Step 5: Run pool-20**

Restart the server:

```powershell
make server-start POOL_SIZE=20
```

Verify actuator output includes `20.0`, then run:

```powershell
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-20 PRESET=phase4-atomic-pool POOL=20 CONDITION=pool-20
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-20
```

- [ ] **Step 6: Run pool-50**

Restart the server:

```powershell
make server-start POOL_SIZE=50
```

Verify actuator output includes `50.0`, then run:

```powershell
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-50 PRESET=phase4-atomic-pool POOL=50 CONDITION=pool-50
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-50
```

- [ ] **Step 7: Capture representative Grafana dashboards**

Capture only the representative conditions `pool-2`, `pool-10`, and `pool-50`.

For each representative condition, locate the latest run-window JSON and pass it through a PowerShell variable:

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
make grafana-capture DASHBOARD=overview GRAFANA_PHASE=phase-04 SCENARIO=atomic PRESET=pool-limit POOL=10 RUN_WINDOW="$runWindow" PARTS_DIR=docs/evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/parts
make evidence-postprocess PHASE=04-db-operational-limits/atomic-pool/pool-10 OUTPUT=docs/evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/stitched-dashboard.png
```

For `pool-2`, use:

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-2/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
make grafana-capture DASHBOARD=overview GRAFANA_PHASE=phase-04 SCENARIO=atomic PRESET=pool-limit POOL=2 RUN_WINDOW="$runWindow" PARTS_DIR=docs/evidence/04-db-operational-limits/atomic-pool/pool-2/grafana/parts
make evidence-postprocess PHASE=04-db-operational-limits/atomic-pool/pool-2 OUTPUT=docs/evidence/04-db-operational-limits/atomic-pool/pool-2/grafana/stitched-dashboard.png
```

For `pool-50`, use:

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
make grafana-capture DASHBOARD=overview GRAFANA_PHASE=phase-04 SCENARIO=atomic PRESET=pool-limit POOL=50 RUN_WINDOW="$runWindow" PARTS_DIR=docs/evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/parts
make evidence-postprocess PHASE=04-db-operational-limits/atomic-pool/pool-50 OUTPUT=docs/evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/stitched-dashboard.png
```

- [ ] **Step 8: Verify Atomic evidence exists**

Run:

```powershell
make phase-status PHASE=04-db-operational-limits/atomic-pool
```

Expected: `pool-2`, `pool-5`, `pool-10`, `pool-20`, and `pool-50` evidence directories exist.

Check each consistency file contains `seat_count_inconsistency` and `overbooked` columns:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool -Recurse -Filter consistency.txt | Select-String "seat_count_inconsistency|overbooked"
```

- [ ] **Step 9: Commit**

```powershell
git add docs/evidence/04-db-operational-limits/atomic-pool
git commit -m "docs: record phase4 atomic pool evidence"
```
