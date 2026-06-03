# 003. k6 Tags and SQL Evidence

### Task 003: Tag k6 Runs and Add Raw SQL Consistency Evidence

**Files:**
- Modify: `scripts/baseline.js`
- Modify: `scripts/spike.js`
- Modify: `scripts/ramp-up.js`
- Modify: `scripts/sustained.js`
- Create: `scripts/sql/phase2-consistency-check.sql`

- [ ] **Step 1: Add final consistency metrics to baseline.js**

Modify `scripts/baseline.js`.

Add imports:

```js
import { Gauge } from "k6/metrics";
```

Add metrics after `BASE_URL`:

```js
const reservationCount = new Gauge("concert_reservation_count");
const remainingSeats = new Gauge("concert_remaining_seats");
const seatCountInconsistency = new Gauge("concert_seat_count_inconsistency");
const overbooked = new Gauge("concert_overbooked");
```

Add tags inside `options` before `scenarios`:

```js
  tags: {
    phase: "phase-02",
    scenario: "no-lock",
    preset: "baseline",
    pool: "default",
  },
```

Add teardown:

```js
export function teardown() {
  const res = http.get(`${BASE_URL}/api/test/consistency`);
  check(res, {
    "consistency snapshot OK": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    return;
  }

  const snapshot = res.json();
  reservationCount.add(snapshot.reservationCount);
  remainingSeats.add(snapshot.remainingSeats);
  seatCountInconsistency.add(snapshot.seatCountInconsistency);
  overbooked.add(snapshot.overbooked ? 1 : 0);
}
```

- [ ] **Step 2: Add common tags to spike.js**

Modify `scripts/spike.js` by adding tags inside `options` before `scenarios`:

```js
  tags: {
    phase: "phase-02",
    scenario: "no-lock",
    preset: "spike",
    pool: "default",
  },
```

- [ ] **Step 3: Add common tags to ramp-up.js**

Modify `scripts/ramp-up.js` by adding tags inside `options` before `scenarios`:

```js
  tags: {
    phase: "phase-02",
    scenario: "no-lock",
    preset: "ramp-up",
    pool: "default",
  },
```

- [ ] **Step 4: Add common tags to sustained.js**

Modify `scripts/sustained.js` by adding tags inside `options` before `scenarios`:

```js
  tags: {
    phase: "phase-02",
    scenario: "no-lock",
    preset: "sustained",
    pool: "default",
  },
```

- [ ] **Step 5: Add raw SQL consistency query**

Create `scripts/sql/phase2-consistency-check.sql`:

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

- [ ] **Step 6: Validate k6 script syntax with Docker**

Run after Spring is running:

```bash
docker compose --profile test run --rm k6 run --out experimental-prometheus-rw /scripts/baseline.js
```

Expected:

- k6 starts successfully
- reset check runs in `setup()`
- baseline requests run
- `consistency snapshot OK` appears in checks

- [ ] **Step 7: Validate SQL evidence command**

Run after the baseline k6 run:

```bash
mkdir -p docs/evidence/02-no-lock-baseline/sql
docker compose exec -T postgres psql -U user -d reservation \
  < scripts/sql/phase2-consistency-check.sql \
  > docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
```

Expected `docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt` contains columns:

```text
concert_id
initial_seat_count
reservation_count
remaining_seats
seat_count_inconsistency
overbooked
```

- [ ] **Step 8: Commit**

```bash
git add scripts/baseline.js scripts/spike.js scripts/ramp-up.js scripts/sustained.js scripts/sql/phase2-consistency-check.sql
git commit -m "feat: add phase2 k6 tags and consistency evidence"
```
