# 005. Integration Verification

### Task 005: Verify Provisioning, Metrics, SQL Evidence, and Capture

**Files:**
- Modify if needed: `docs/phases/02-no-lock-baseline/runbook.md`
- Modify if needed: `docs/phases/02-no-lock-baseline/observability.md`

- [ ] **Step 1: Regenerate dashboards**

Run:

```bash
npm run grafana:generate
```

Expected:

- `grafana/dashboards/concurrency-lab-overview.json` is regenerated
- `grafana/dashboards/phase-02-no-lock-baseline.json` is regenerated

- [ ] **Step 2: Start infrastructure**

Run:

```bash
docker compose up -d
```

Expected:

- `postgres` is healthy
- `postgres_exporter` is running
- `prometheus` is running
- `grafana` is running

- [ ] **Step 3: Start Spring Boot**

Run in a separate terminal:

```bash
cd concurrency
./gradlew bootRun
```

Expected: Spring Boot listens on `http://localhost:8080`.

- [ ] **Step 4: Verify consistency API manually**

Run:

```bash
curl -s http://localhost:8080/api/test/consistency
```

Expected JSON shape:

```json
{
  "concertId": 1,
  "initialSeatCount": 100,
  "reservationCount": 0,
  "remainingSeats": 100,
  "seatCountInconsistency": 0,
  "overbooked": false
}
```

The exact `reservationCount` and `remainingSeats` may differ if the DB was not reset. If so, run:

```bash
curl -X POST http://localhost:8080/api/test/reset
curl -s http://localhost:8080/api/test/consistency
```

- [ ] **Step 5: Verify Grafana anonymous access**

Run:

```bash
curl -s http://localhost:3000/api/health
```

Expected: JSON includes `database` with value `ok`.

Open:

```text
http://localhost:3000/d/concurrency-lab-overview/concurrency-lab-overview
http://localhost:3000/d/phase-02-no-lock-baseline/phase-2-no-lock-baseline
```

Expected: dashboards open without login.

- [ ] **Step 6: Run Phase 2 baseline k6**

Run:

```bash
docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/baseline.js
```

Expected:

- k6 completes
- reset check passes
- reservation requests run
- consistency snapshot check passes

- [ ] **Step 7: Verify k6 labels in Prometheus**

Run:

```bash
curl -G "http://localhost:9090/api/v1/query" \
  --data-urlencode 'query=sum(k6_http_reqs_total{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"})'
```

Expected: Prometheus returns a non-empty `result` array after k6 data arrives.

- [ ] **Step 8: Verify consistency custom metrics in Prometheus**

Run:

```bash
curl -G "http://localhost:9090/api/v1/query" \
  --data-urlencode 'query=max(concert_seat_count_inconsistency{phase="phase-02",scenario="no-lock",preset="baseline",pool="default"})'
```

Expected: Prometheus returns a numeric value. If it returns no data, replace k6 `teardown()` with an explicit final snapshot scenario in a follow-up task.

- [ ] **Step 9: Write SQL evidence**

Run:

```bash
mkdir -p docs/evidence/02-no-lock-baseline/sql
docker compose exec -T postgres psql -U user -d reservation \
  < scripts/sql/phase2-consistency-check.sql \
  > docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
```

Expected:

```bash
cat docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
```

Shows the final Concert 1 consistency row.

- [ ] **Step 10: Capture Grafana parts with user present**

Run:

```bash
npm run grafana:capture:phase2
```

Expected:

- `docs/evidence/02-no-lock-baseline/grafana/parts/part-01-scroll0.png` exists
- more parts exist when the dashboard is taller than one viewport
- `docs/evidence/02-no-lock-baseline/grafana/parts/capture-meta.json` exists

If capture fails because the selector is stale, inspect the actual Grafana dashboard container with the user and rerun:

```bash
npm run grafana:capture -- --dashboard phase2 --phase phase-02 --scenario no-lock --preset baseline --pool default --live --selector "<actual selector>"
```

- [ ] **Step 11: Update Phase 2 docs if commands changed**

If the implementation changed command names or evidence paths, update:

- `docs/phases/02-no-lock-baseline/runbook.md`
- `docs/phases/02-no-lock-baseline/observability.md`

Add these exact lines to the runbook if missing:

```markdown
8. Generate Grafana dashboards.

   ```bash
   npm run grafana:generate
   ```

9. Save SQL consistency evidence.

   ```bash
   docker compose exec -T postgres psql -U user -d reservation \
     < scripts/sql/phase2-consistency-check.sql \
     > docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
   ```

10. Capture Grafana dashboard parts.

   ```bash
   npm run grafana:capture:phase2
   ```
```

- [ ] **Step 12: Run test suite**

Run:

```bash
cd concurrency
./gradlew test
```

Expected: all tests pass.

- [ ] **Step 13: Review final working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected:

- source/config changes from the numbered tasks
- generated dashboard JSON changes
- no `node_modules/`
- no accidental screenshots unless intentionally kept as evidence

- [ ] **Step 14: Commit verification docs if changed**

If Phase 2 docs were updated:

```bash
git add docs/phases/02-no-lock-baseline/runbook.md docs/phases/02-no-lock-baseline/observability.md
git commit -m "docs: document phase2 grafana evidence flow"
```

If no docs changed, skip this commit.
