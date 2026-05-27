# 005. Reporting and Final Verification

### Task 005: Fill Phase 4 Report and Verify Completion

**Files:**
- Modify: `docs/phases/04-db-operational-limits/report.md`
- Read evidence: `docs/evidence/04-db-operational-limits/atomic-pool/`
- Read evidence: `docs/evidence/04-db-operational-limits/pessimistic-pool/`
- Read evidence: `docs/evidence/04-db-operational-limits/pessimistic-timeout/`

- [ ] **Step 1: Extract k6 metrics**

For each condition, open the latest k6 summary JSON under its evidence directory:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits -Recurse -Filter "*summary.json" | Sort-Object FullName
```

Record:

- RPS from `http_reqs.rate`
- p95 from `http_req_duration.percentiles["95"]`
- iterations from `iterations.count`
- final consistency metrics from k6 custom metrics when present

Use Prometheus run-window evidence for p99 if the k6 summary lacks p99.

- [ ] **Step 2: Extract p99 from Prometheus when needed**

For each run-window JSON, query Prometheus for `k6_http_req_duration_p99` over the run window.

Use the same method used in Phase 3 reporting. Record p99 in milliseconds in `report.md`.

- [ ] **Step 3: Extract SQL consistency results**

Open each `consistency.txt`:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits -Recurse -Filter consistency.txt | Sort-Object FullName
```

For every condition, record:

- `reservation_count`
- `remaining_seats`
- `seat_count_inconsistency`
- `overbooked`

Expected invariant for completed conditions:

```text
seat_count_inconsistency = 0
overbooked = f
```

- [ ] **Step 4: Fill Atomic Pool Result**

Update `docs/phases/04-db-operational-limits/report.md` section `Atomic Pool Result`.

Fill one row for each pool size:

- `2`
- `5`
- `10`
- `20`
- `50`

Each evidence cell should link to:

- k6 summary JSON
- SQL consistency file
- Grafana stitched dashboard if captured for that condition

- [ ] **Step 5: Fill Pessimistic Pool Result**

Update section `Pessimistic Pool Result`.

Fill one row for each pool size:

- `2`
- `5`
- `10`
- `20`
- `50`

For `pool-10` and `pool-50`, include links to:

- `pg-locks.txt`
- `pg-stat-activity.txt`

If a snapshot file exists but captured no waiting rows, state that in the observation text rather than deleting the evidence.

- [ ] **Step 6: Fill Pessimistic Timeout Result**

Update section `Pessimistic Timeout Result`.

Fill one row for each timeout setting:

- `200`
- `500`
- `1000`

Record:

- successful Reservations
- sold-out count
- lock-timeout response count
- p95
- p99
- consistency values
- evidence links

- [ ] **Step 7: Write Findings**

In `## Findings`, answer these questions directly:

- Which Atomic pool size is the first point where RPS or p99 stops improving materially?
- Does increasing pool size beyond `10` improve Atomic throughput enough to justify the extra DB concurrency?
- Does Pessimistic Lock p99 correlate with lock wait or Hikari pending?
- Does `lock_timeout` convert long lock waits into controlled failures?
- Did any condition create Seat Count Inconsistency or Overbooking?

- [ ] **Step 8: Write Decision**

In `## Decision`, record operational guidance:

- recommended DB pool size for this workload
- whether Atomic Conditional Update remains the DB baseline for Phase 5 Redis comparison
- whether Pessimistic Lock should remain a correctness reference rather than default strategy
- whether `lock_timeout` should be considered for lock-heavy paths

- [ ] **Step 9: Write Next Phase Input**

In `## Next Phase Input`, specify the DB baseline Redis should compare against:

```markdown
Phase 5 should compare Redis strategies against Atomic Conditional Update at the selected Phase 4 DB pool setting and the Phase 3/4 baseline k6 shape.
```

Add timeout or lock-wait caveats if Phase 4 evidence shows they are operationally important.

- [ ] **Step 10: Verify report links and docs**

Run:

```powershell
rg -n "Not measured yet|Not recorded yet|04-db-limits|DB Limit Experiments" docs/phases/04-db-operational-limits docs/roadmap docs/README.md
```

Expected:

- no `04-db-limits`
- no `DB Limit Experiments`
- no `Not measured yet` or `Not recorded yet` in `report.md`

Run:

```powershell
git diff --check
```

Expected: exit code `0`.

- [ ] **Step 11: Commit**

```powershell
git add docs/phases/04-db-operational-limits/report.md
git commit -m "docs: report phase4 db operational limits"
```
