# 004. k6 Phase 3 Presets and Evidence Query

### Task 004: Add Strategy-Specific Baseline Load Test Presets

**Files:**
- Modify: `k6/reservation-test.js`
- Create: `k6/presets/phase3-pessimistic-baseline.json`
- Create: `k6/presets/phase3-optimistic-baseline.json`
- Create: `k6/presets/phase3-atomic-baseline.json`
- Create: `scripts/sql/phase3-consistency-check.sql`

- [ ] **Step 1: Make k6 request path configurable**

Modify `k6/reservation-test.js`.

Add this constant after `baseUrl`:

```javascript
const reservationPath = preset.path || "/api/reservations";
```

Change the `http.post` URL in `default function` from:

```javascript
`${baseUrl}/api/reservations`
```

to:

```javascript
`${baseUrl}${reservationPath}`
```

- [ ] **Step 2: Add pessimistic baseline preset**

Create `k6/presets/phase3-pessimistic-baseline.json`:

```json
{
  "phase": "phase-03",
  "evidenceDir": "03-db-strategies/pessimistic-lock",
  "scenario": "pessimistic",
  "preset": "baseline",
  "pool": "default",
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

- [ ] **Step 3: Add optimistic baseline preset**

Create `k6/presets/phase3-optimistic-baseline.json`:

```json
{
  "phase": "phase-03",
  "evidenceDir": "03-db-strategies/optimistic-lock",
  "scenario": "optimistic",
  "preset": "baseline",
  "pool": "default",
  "path": "/api/reservations/optimistic",
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

- [ ] **Step 4: Add atomic baseline preset**

Create `k6/presets/phase3-atomic-baseline.json`:

```json
{
  "phase": "phase-03",
  "evidenceDir": "03-db-strategies/atomic-update",
  "scenario": "atomic",
  "preset": "baseline",
  "pool": "default",
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

- [ ] **Step 5: Add Phase 3 SQL evidence query**

Create `scripts/sql/phase3-consistency-check.sql`:

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

- [ ] **Step 6: Verify preset parsing locally**

Run:

```powershell
node scripts/verify-k6-reservation-responses.js
```

Expected: PASS.

Run:

```powershell
bash k6/run.sh phase3-pessimistic-baseline local
```

Expected: If the app is not running, the command fails with a connection error after successfully loading the preset. If the app is running, k6 writes evidence under `docs/evidence/03-db-strategies/pessimistic-lock/`.

- [ ] **Step 7: Commit**

```powershell
git add k6/reservation-test.js `
        k6/presets/phase3-pessimistic-baseline.json `
        k6/presets/phase3-optimistic-baseline.json `
        k6/presets/phase3-atomic-baseline.json `
        scripts/sql/phase3-consistency-check.sql
git commit -m "feat: add phase3 k6 strategy presets"
```

