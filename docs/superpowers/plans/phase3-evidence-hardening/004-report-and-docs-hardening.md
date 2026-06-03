# 004. Report와 Phase 문서 갱신

### Task 004: 새 evidence만 근거로 Phase 3 문서 갱신

**Files:**
- Modify: `docs/phases/03-db-strategies/report.md`
- Modify: `docs/phases/03-db-strategies/README.md`
- Modify: `docs/phases/03-db-strategies/scope.md`
- Modify: `docs/phases/03-db-strategies/observability.md`
- Modify: `docs/phases/03-db-strategies/runbook.md`

- [ ] **Step 1: 최신 evidence에서 report 입력값을 추출한다**

Run:

```bash
rtk node - <<'NODE'
const fs = require("fs");

const strategies = [
  ["Pessimistic Lock", "pessimistic-lock"],
  ["Optimistic Lock + Retry", "optimistic-lock"],
  ["Atomic Conditional Update", "atomic-update"],
];

function latest(dir, suffix) {
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .sort()
    .at(-1);
}

for (const [label, strategy] of strategies) {
  const base = `docs/evidence/03-db-strategies/${strategy}`;
  const summaryFile = latest(`${base}/k6`, "-summary.json");
  const summary = JSON.parse(fs.readFileSync(`${base}/k6/${summaryFile}`, "utf8"));
  const metrics = summary.metrics;
  const row = {
    strategy: label,
    summary: `${base}/k6/${summaryFile}`,
    iterations: metrics.iterations?.values?.count ?? null,
    rps: metrics.http_reqs?.values?.rate ?? null,
    p95: metrics.http_req_duration?.values?.["p(95)"] ?? null,
    p99: metrics.http_req_duration?.values?.["p(99)"] ?? null,
    httpFailedRate: metrics.http_req_failed?.values?.rate ?? null,
    reserved: metrics.reservation_reserved?.values?.count ?? 0,
    soldOut: metrics.reservation_sold_out?.values?.count ?? 0,
    optimisticExhausted: metrics.reservation_optimistic_lock_exhausted?.values?.count ?? 0,
    unexpected: metrics.reservation_unexpected_status?.values?.count ?? 0,
    reservationCount: metrics.concert_reservation_count?.values?.value ?? null,
    remainingSeats: metrics.concert_remaining_seats?.values?.value ?? null,
    inconsistency: metrics.concert_seat_count_inconsistency?.values?.value ?? null,
    overbooked: metrics.concert_overbooked?.values?.value ?? null,
  };
  console.log(JSON.stringify(row, null, 2));
}
NODE
```

Expected:

```text
{
  "strategy": "Pessimistic Lock",
  ...
}
{
  "strategy": "Optimistic Lock + Retry",
  ...
}
{
  "strategy": "Atomic Conditional Update",
  ...
}
```

- [ ] **Step 2: Prometheus raw evidence 값을 확인한다**

Run:

```bash
rtk node - <<'NODE'
const fs = require("fs");
const files = [
  "docs/evidence/03-db-strategies/pessimistic-lock/prometheus/pg-locks-count.json",
  "docs/evidence/03-db-strategies/optimistic-lock/prometheus/optimistic-retry-total.json",
  "docs/evidence/03-db-strategies/pessimistic-lock/prometheus/k6-window-summary.json",
  "docs/evidence/03-db-strategies/optimistic-lock/prometheus/k6-window-summary.json",
  "docs/evidence/03-db-strategies/atomic-update/prometheus/k6-window-summary.json",
];

for (const file of files) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`\n${file}`);
  console.log(JSON.stringify(json, null, 2));
}
NODE
```

Expected:

```text
docs/evidence/03-db-strategies/pessimistic-lock/prometheus/pg-locks-count.json
...
docs/evidence/03-db-strategies/optimistic-lock/prometheus/optimistic-retry-total.json
...
```

값이 `null`이면 report의 limitation에 metric 부재 또는 query result 부재를 명시한다.

- [ ] **Step 3: `report.md` 구조를 새 evidence 기준으로 재작성한다**

`docs/phases/03-db-strategies/report.md`에 아래 섹션을 포함한다.

```markdown
## Experimental Setup

- Date:
- Application profile:
- Database:
- k6 preset:
- VUs:
- Duration:
- Reset policy:
- Expected HTTP status:

## Metric Definitions

- RPS:
- p95/p99:
- `reservation_reserved`:
- `reservation_sold_out`:
- `reservation_optimistic_lock_exhausted`:
- `reservation_unexpected_status`:
- `reservation_optimistic_retry_total`:
- `pg_locks_count`:
- Seat count inconsistency:
- Overbooking:

## Evidence Source

| Strategy | k6 Summary | SQL Snapshot | Prometheus Raw Query | Grafana |
| --- | --- | --- | --- | --- |
| Pessimistic Lock |  |  |  |  |
| Optimistic Lock + Retry |  |  |  |  |
| Atomic Conditional Update |  |  |  |  |

## Results

| Strategy | RPS | p95 ms | p99 ms | HTTP Failure Rate | Reserved | Sold Out | Optimistic Exhausted | Unexpected | Retry Attempts | Seat Inconsistency | Overbooking | Lock Activity |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Pessimistic Lock |  |  |  |  |  |  |  |  |  |  |  |  |
| Optimistic Lock + Retry |  |  |  |  |  |  |  |  |  |  |  |  |
| Atomic Conditional Update |  |  |  |  |  |  |  |  |  |  |  |  |

## Findings

## Limitations

## Decision

## Next Phase Input
```

표의 빈 칸은 Step 1, Step 2에서 확인한 실제 값으로 채운다.

- [ ] **Step 4: 결론 작성 규칙을 지킨다**

`Decision` 섹션은 아래 조건으로 작성한다.

```text
세 전략의 RPS, p95, p99, unexpected response, retry exhaustion, seat invariant 결과를 비교한 뒤 결론을 작성한다.
Atomic이 가장 적합하다는 문장은 실제 측정값이 지지할 때만 쓴다.
측정값이 비슷하거나 trade-off가 갈리면 "이번 baseline에서는 단정하지 않는다"라고 쓴다.
```

- [ ] **Step 5: README, scope, observability, runbook을 갱신한다**

`README.md`에는 Phase 3 상태를 실제 상태로 적는다.

```markdown
Status: Completed with hardened evidence
```

`scope.md`에는 completion gate를 실제 상태로 갱신한다.

```markdown
- [x] 세 DB 전략 baseline 실행
- [x] counted-seat invariant 확인
- [x] k6 p95/p99 summary evidence 저장
- [x] 409 body 기반 response classification 저장
- [x] Optimistic retry raw Prometheus evidence 저장
- [x] Pessimistic lock activity raw Prometheus evidence 저장
```

`observability.md`에는 source of truth를 명시한다.

```markdown
- Latency/RPS source of truth: k6 summary JSON
- Retry count source of truth: Prometheus raw query JSON
- Lock activity source of truth: Prometheus raw query JSON
- Final seat invariant source of truth: SQL consistency snapshot
- Grafana screenshot: visual evidence, not numeric source of truth
```

`runbook.md`에는 Task 003의 실행 순서를 Phase 3 재현 절차로 기록한다.

- [ ] **Step 6: archive evidence 참조가 남아 있지 않은지 확인한다**

Run:

```bash
rtk rg "archive/20260527-original|20260527-091" docs/phases/03-db-strategies docs/superpowers/specs/2026-05-30-phase3-evidence-hardening-design.md
```

Expected:

```text
docs/superpowers/specs/2026-05-30-phase3-evidence-hardening-design.md: 기존 evidence archive 설명만 출력될 수 있다
```

`docs/phases/03-db-strategies` 아래에는 archive evidence 참조가 없어야 한다.

- [ ] **Step 7: Commit**

Run:

```bash
rtk git add docs/phases/03-db-strategies
rtk git commit -m "docs: update phase3 hardened report"
```

Expected:

```text
[... docs: update phase3 hardened report]
```
