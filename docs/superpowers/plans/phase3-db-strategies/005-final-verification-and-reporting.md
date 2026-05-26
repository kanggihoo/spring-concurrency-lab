# 005. Final Verification and Reporting

### Task 005: Verify Phase 3 and Record Strategy Comparison

**Files:**
- Modify: `docs/phases/03-db-strategies/report.md`
- Modify: `docs/phases/03-db-strategies/runbook.md`
- Modify: `docs/phases/03-db-strategies/observability.md`
- Optional Modify: `concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java`

- [ ] **Step 1: Run all application tests**

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

- [ ] **Step 2: Run Phase 3 k6 baselines sequentially**

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

- [ ] **Step 3: Capture Grafana overview for each strategy**

Use the existing overview dashboard. Run one capture per strategy, substituting the latest run-window file path when needed:

```powershell
npm run grafana:capture -- --dashboard overview --phase phase-03 --scenario pessimistic --preset baseline --pool default --run-window auto
npm run grafana:capture -- --dashboard overview --phase phase-03 --scenario optimistic --preset baseline --pool default --run-window auto
npm run grafana:capture -- --dashboard overview --phase phase-03 --scenario atomic --preset baseline --pool default --run-window auto
```

Expected: Grafana capture parts and metadata are written under each strategy's `grafana/` evidence directory.

- [ ] **Step 4: Run SQL consistency evidence after each strategy**

After each k6 run, save SQL output to that strategy directory:

```powershell
docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/phase3-consistency-check.sql `
  > docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt
```

Repeat with these output paths:

```text
docs/evidence/03-db-strategies/optimistic-lock/sql/baseline-consistency.txt
docs/evidence/03-db-strategies/atomic-update/sql/baseline-consistency.txt
```

Expected for each strategy:

```text
seat_count_inconsistency = 0
overbooked = false
```

- [ ] **Step 5: Update Phase 3 report**

Modify `docs/phases/03-db-strategies/report.md`.

Fill `Strategy Comparison` with measured values from the k6 summary JSON and SQL evidence. Keep this table shape:

```markdown
| Strategy | RPS | p95 | p99 | Expected Failure Rate | Seat Count Inconsistency | Overbooking | Evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| Pessimistic Lock |  |  |  |  | 0 | 0 | `docs/evidence/03-db-strategies/pessimistic-lock/...` |
| Optimistic Lock + Retry |  |  |  |  | 0 | 0 | `docs/evidence/03-db-strategies/optimistic-lock/...` |
| Atomic Conditional Update |  |  |  |  | 0 | 0 | `docs/evidence/03-db-strategies/atomic-update/...` |
```

Fill `Strategy Metrics` with retry, sold-out, and lock wait observations:

```markdown
| Strategy | Retry Count | Sold-out Count | Lock Wait Signal |
|---|---:|---:|---|
| Pessimistic Lock | N/A |  |  |
| Optimistic Lock + Retry |  |  | N/A |
| Atomic Conditional Update | N/A |  | N/A |
```

- [ ] **Step 6: Update Phase 3 runbook and observability docs**

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

- [ ] **Step 7: Final verification**

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

- [ ] **Step 8: Commit**

```powershell
git add docs/phases/03-db-strategies/report.md `
        docs/phases/03-db-strategies/runbook.md `
        docs/phases/03-db-strategies/observability.md `
        docs/evidence/03-db-strategies `
        concurrency/src/test/java/com/example/concurrency/ReservationConcurrencyTest.java
git commit -m "docs: record phase3 db strategy results"
```

