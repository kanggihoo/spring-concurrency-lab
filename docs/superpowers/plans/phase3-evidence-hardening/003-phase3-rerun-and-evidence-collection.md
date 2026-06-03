# 003. Phase 3 Baseline 재실행과 Evidence 수집

### Task 003: 세 전략을 같은 baseline 조건에서 한 번씩 재측정

**Files:**
- Generate: `docs/evidence/03-db-strategies/pessimistic-lock/k6/*-summary.json`
- Generate: `docs/evidence/03-db-strategies/pessimistic-lock/logs/*.log`
- Generate: `docs/evidence/03-db-strategies/pessimistic-lock/sql/*.txt`
- Generate: `docs/evidence/03-db-strategies/pessimistic-lock/prometheus/*.json`
- Generate: `docs/evidence/03-db-strategies/pessimistic-lock/grafana/**`
- Generate: `docs/evidence/03-db-strategies/optimistic-lock/k6/*-summary.json`
- Generate: `docs/evidence/03-db-strategies/optimistic-lock/logs/*.log`
- Generate: `docs/evidence/03-db-strategies/optimistic-lock/sql/*.txt`
- Generate: `docs/evidence/03-db-strategies/optimistic-lock/prometheus/*.json`
- Generate: `docs/evidence/03-db-strategies/optimistic-lock/grafana/**`
- Generate: `docs/evidence/03-db-strategies/atomic-update/k6/*-summary.json`
- Generate: `docs/evidence/03-db-strategies/atomic-update/logs/*.log`
- Generate: `docs/evidence/03-db-strategies/atomic-update/sql/*.txt`
- Generate: `docs/evidence/03-db-strategies/atomic-update/prometheus/*.json`
- Generate: `docs/evidence/03-db-strategies/atomic-update/grafana/**`

- [ ] **Step 1: infra를 시작한다**

Run:

```bash
rtk make db-start
```

Expected:

```text
docker compose up -d postgres postgres_exporter prometheus grafana
```

- [ ] **Step 2: 애플리케이션을 별도 터미널에서 시작한다**

Run:

```bash
rtk make server-start
```

Expected:

```text
Tomcat started on port 8080
```

이 터미널은 세 전략 실행이 끝날 때까지 유지한다.

- [ ] **Step 3: 사전 테스트 로그를 evidence로 저장한다**

Run:

```bash
rtk bash -lc 'set -o pipefail; mkdir -p docs/evidence/03-db-strategies/test; cd concurrency && ./gradlew test | tee "../docs/evidence/03-db-strategies/test/gradle-test-$(date +%Y%m%d-%H%M%S).log"'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 4: Pessimistic baseline을 실행한다**

터미널 A에서 실행한다.

```bash
rtk bash k6/run.sh phase3-pessimistic-baseline prometheus
```

Expected:

```text
k6 summary: .../docs/evidence/03-db-strategies/pessimistic-lock/k6/phase3-pessimistic-baseline-prometheus-...-summary.json
k6 run window: .../docs/evidence/03-db-strategies/pessimistic-lock/grafana/run-window-phase3-pessimistic-baseline-prometheus-....json
```

- [ ] **Step 5: Pessimistic 실행 중 lock snapshot을 시도한다**

터미널 B에서 k6 실행 직후 아래 명령을 실행한다.

```bash
rtk docker compose exec -T postgres psql -U user -d reservation < scripts/sql/pg-stat-activity-phase3.sql > docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-stat-activity.txt
rtk docker compose exec -T postgres psql -U user -d reservation < scripts/sql/pg-lock-summary.sql > docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-lock-summary.txt
```

Expected:

```text
docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-stat-activity.txt
docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-lock-summary.txt
```

snapshot에 wait row가 없으면 report에는 lock wait를 관측했다고 쓰지 않는다.

- [ ] **Step 6: Pessimistic 후속 evidence를 저장한다**

Run:

```bash
rtk make phase3-sql-consistency STRATEGY=pessimistic-lock
rtk sh -lc 'run_window=$(ls -t docs/evidence/03-db-strategies/pessimistic-lock/grafana/run-window-phase3-pessimistic-baseline-prometheus-*.json | head -n 1); npm run prometheus:phase3 -- --strategy pessimistic-lock --run-window "$run_window" --out-dir docs/evidence/03-db-strategies/pessimistic-lock/prometheus'
rtk make phase3-grafana-capture STRATEGY=pessimistic-lock
rtk make phase3-grafana-stitch STRATEGY=pessimistic-lock
```

Expected:

```text
docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt
docs/evidence/03-db-strategies/pessimistic-lock/prometheus/k6-window-summary.json
docs/evidence/03-db-strategies/pessimistic-lock/prometheus/pg-locks-count.json
docs/evidence/03-db-strategies/pessimistic-lock/grafana/stitched-dashboard.png
```

- [ ] **Step 7: Optimistic baseline과 후속 evidence를 저장한다**

Run:

```bash
rtk bash k6/run.sh phase3-optimistic-baseline prometheus
rtk make phase3-sql-consistency STRATEGY=optimistic-lock
rtk sh -lc 'run_window=$(ls -t docs/evidence/03-db-strategies/optimistic-lock/grafana/run-window-phase3-optimistic-baseline-prometheus-*.json | head -n 1); npm run prometheus:phase3 -- --strategy optimistic-lock --run-window "$run_window" --out-dir docs/evidence/03-db-strategies/optimistic-lock/prometheus'
rtk make phase3-grafana-capture STRATEGY=optimistic-lock
rtk make phase3-grafana-stitch STRATEGY=optimistic-lock
```

Expected:

```text
docs/evidence/03-db-strategies/optimistic-lock/k6/*-summary.json
docs/evidence/03-db-strategies/optimistic-lock/sql/baseline-consistency.txt
docs/evidence/03-db-strategies/optimistic-lock/prometheus/k6-window-summary.json
docs/evidence/03-db-strategies/optimistic-lock/prometheus/optimistic-retry-total.json
docs/evidence/03-db-strategies/optimistic-lock/grafana/stitched-dashboard.png
```

- [ ] **Step 8: Atomic baseline과 후속 evidence를 저장한다**

Run:

```bash
rtk bash k6/run.sh phase3-atomic-baseline prometheus
rtk make phase3-sql-consistency STRATEGY=atomic-update
rtk sh -lc 'run_window=$(ls -t docs/evidence/03-db-strategies/atomic-update/grafana/run-window-phase3-atomic-baseline-prometheus-*.json | head -n 1); npm run prometheus:phase3 -- --strategy atomic-update --run-window "$run_window" --out-dir docs/evidence/03-db-strategies/atomic-update/prometheus'
rtk make phase3-grafana-capture STRATEGY=atomic-update
rtk make phase3-grafana-stitch STRATEGY=atomic-update
```

Expected:

```text
docs/evidence/03-db-strategies/atomic-update/k6/*-summary.json
docs/evidence/03-db-strategies/atomic-update/sql/baseline-consistency.txt
docs/evidence/03-db-strategies/atomic-update/prometheus/k6-window-summary.json
docs/evidence/03-db-strategies/atomic-update/grafana/stitched-dashboard.png
```

- [ ] **Step 9: summary JSON에 p99와 response counter가 있는지 확인한다**

Run:

```bash
rtk node - <<'NODE'
const fs = require("fs");
const strategies = ["pessimistic-lock", "optimistic-lock", "atomic-update"];
for (const strategy of strategies) {
  const dir = `docs/evidence/03-db-strategies/${strategy}/k6`;
  const file = fs.readdirSync(dir).filter((name) => name.endsWith("-summary.json")).sort().at(-1);
  const summary = JSON.parse(fs.readFileSync(`${dir}/${file}`, "utf8"));
  const required = [
    "http_req_duration",
    "reservation_reserved",
    "reservation_sold_out",
    "reservation_optimistic_lock_exhausted",
    "reservation_unexpected_status",
    "concert_reservation_count",
    "concert_remaining_seats",
    "concert_seat_count_inconsistency",
    "concert_overbooked",
  ];
  for (const metric of required) {
    if (!summary.metrics[metric]) throw new Error(`${strategy} missing ${metric}`);
  }
  if (summary.metrics.http_req_duration.values["p(99)"] === undefined) {
    throw new Error(`${strategy} missing p(99)`);
  }
  console.log(`${strategy}: ${file} ok`);
}
NODE
```

Expected:

```text
pessimistic-lock: ... ok
optimistic-lock: ... ok
atomic-update: ... ok
```

- [ ] **Step 10: Commit**

Run:

```bash
rtk git add docs/evidence/03-db-strategies
rtk git commit -m "docs: collect phase3 hardened evidence"
```

Expected:

```text
[... docs: collect phase3 hardened evidence]
```
