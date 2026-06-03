# 005. Final Verification and Reporting

### Task 005: Verify Phase 3 and Record Strategy Comparison

**Files:**
- Modify: `docs/phases/03-db-strategies/report.md`
- Modify: `docs/phases/03-db-strategies/runbook.md`
- Modify: `docs/phases/03-db-strategies/observability.md`
- Optional Modify: `concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java`

- [x] **Step 1: Run all application tests**

Run:

```powershell
cd concurrency
.\gradlew.bat test
```

Expected: PASS, except `ReservationConcurrencyTest` may fail if it still asserts Phase 2 no-lock inconsistency after `@Version`.

If `ReservationConcurrencyTest` fails because Phase 3 `@Version` changes legacy no-lock behavior, disable that class for Phase 3 with an explicit reason:

```java
@Disabled("Phase 2 no-lock baseline is fixed by recorded evidence; Phase 3 adds @Version for optimistic strategy.")
```

Add the import:

```java
import org.junit.jupiter.api.Disabled;
```

Then rerun:

```powershell
cd concurrency
.\gradlew.bat test
```

Expected: PASS.

- [x] **Step 2: Run Phase 3 k6 baselines sequentially**

Start the app and observability stack using the repo's local environment guide. Then run:

```powershell
bash k6/run.sh phase3-pessimistic-baseline prometheus
bash k6/run.sh phase3-optimistic-baseline prometheus
bash k6/run.sh phase3-atomic-baseline prometheus
```

Expected evidence:

- `docs/evidence/03-db-strategies/pessimistic-lock/k6/*-summary.json`
- `docs/evidence/03-db-strategies/optimistic-lock/k6/*-summary.json`
- `docs/evidence/03-db-strategies/atomic-update/k6/*-summary.json`

- [x] **Step 3: Capture Grafana overview for each strategy**

Use the existing overview dashboard. For Phase 3, use the Makefile target that finds the latest strategy-specific run-window and passes it explicitly to the capture script:

```powershell
make phase3-grafana-capture STRATEGY=pessimistic-lock
make phase3-grafana-capture STRATEGY=optimistic-lock
make phase3-grafana-capture STRATEGY=atomic-update
```

Expected: Grafana capture parts and metadata are written under each strategy's `grafana/` evidence directory.

- [x] **Step 4: Stitch Grafana overview captures**

Run:

```powershell
make phase3-grafana-stitch STRATEGY=pessimistic-lock
make phase3-grafana-stitch STRATEGY=optimistic-lock
make phase3-grafana-stitch STRATEGY=atomic-update
```

Expected:

- `docs/evidence/03-db-strategies/pessimistic-lock/grafana/stitched-dashboard.png`
- `docs/evidence/03-db-strategies/optimistic-lock/grafana/stitched-dashboard.png`
- `docs/evidence/03-db-strategies/atomic-update/grafana/stitched-dashboard.png`

- [x] **Step 5: Run SQL consistency evidence after each strategy**

After each k6 run, save SQL output to that strategy directory:

```powershell
make phase3-sql-consistency STRATEGY=pessimistic-lock
make phase3-sql-consistency STRATEGY=optimistic-lock
make phase3-sql-consistency STRATEGY=atomic-update
```

`make phase3-sql-consistencies` runs all three commands, but use it only when each strategy's database state is still the state produced by that strategy run.

Expected for each strategy:

```text
seat_count_inconsistency = 0
overbooked = false
```

- [x] **Step 6: Update Phase 3 report**

Modify `docs/phases/03-db-strategies/report.md`.

Fill `Strategy Comparison` with measured values from k6 summary JSON, Prometheus p99, and consistency evidence. If raw SQL files were not captured immediately after the matching strategy run, use the k6 teardown consistency snapshot and call that out in the report. Keep this table shape:

```markdown
| Strategy | RPS | p95 | p99 | Expected Failure Rate | Seat Count Inconsistency | Overbooking | Evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| Pessimistic Lock |  |  |  |  | 0 | 0 | `docs/evidence/03-db-strategies/pessimistic-lock/...` |
| Optimistic Lock + Retry |  |  |  |  | 0 | 0 | `docs/evidence/03-db-strategies/optimistic-lock/...` |
| Atomic Conditional Update |  |  |  |  | 0 | 0 | `docs/evidence/03-db-strategies/atomic-update/...` |
```

Fill `Strategy Metrics` with retry, rejected request, and lock activity observations:

```markdown
| Strategy | Retry Count | Rejected Request Count | Lock Wait Signal |
|---|---:|---:|---|
| Pessimistic Lock | N/A |  |  |
| Optimistic Lock + Retry |  |  | N/A |
| Atomic Conditional Update | N/A |  | N/A |
```

- [x] **Step 7: Update Phase 3 runbook and observability docs**

Modify `docs/phases/03-db-strategies/runbook.md` so the exact commands include the three Phase 3 preset names:

```markdown
bash k6/run.sh phase3-pessimistic-baseline prometheus
bash k6/run.sh phase3-optimistic-baseline prometheus
bash k6/run.sh phase3-atomic-baseline prometheus
```

Modify `docs/phases/03-db-strategies/observability.md` to mention these label combinations:

```markdown
- `phase="phase-03", scenario="pessimistic", preset="baseline", pool="default"`
- `phase="phase-03", scenario="optimistic", preset="baseline", pool="default"`
- `phase="phase-03", scenario="atomic", preset="baseline", pool="default"`
```

- [x] **Step 8: Final verification**

Run:

```powershell
cd concurrency
.\gradlew.bat test
```

Expected: PASS.

Run:

```powershell
git status --short
```

Expected: only intended docs/evidence changes are listed.

- [ ] **Step 9: Commit**

```powershell
git add docs/phases/03-db-strategies/report.md `
        docs/phases/03-db-strategies/runbook.md `
        docs/phases/03-db-strategies/observability.md `
        docs/evidence/03-db-strategies `
        concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java
git commit -m "docs: record phase3 db strategy results"
```
