# 004. Report와 Phase Docs 보강

### Task 004: 강화된 evidence 기준으로 Phase 4 report와 phase docs 갱신

**Files:**
- Modify: `docs/phases/04-db-operational-limits/report.md`
- Modify: `docs/phases/04-db-operational-limits/README.md`
- Modify: `docs/phases/04-db-operational-limits/scope.md`
- Modify: `docs/phases/04-db-operational-limits/observability.md`

- [ ] **Step 1: k6 summary에서 report table 값을 추출한다**

Run:

```powershell
@'
const fs = require("fs");
const path = require("path");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith("-summary.json")) files.push(full);
  }
  return files;
}

for (const file of walk("docs/evidence/04-db-operational-limits").sort()) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const m = json.metrics;
  console.log([
    file,
    `rps=${m.http_reqs.rate.toFixed(2)}`,
    `p95=${m.http_req_duration["p(95)"].toFixed(2)}`,
    `p99=${m.http_req_duration["p(99)"].toFixed(2)}`,
    `iterations=${m.iterations.count}`,
    `failed=${m.http_req_failed.value}`,
    `reserved=${m.reservation_reserved?.count ?? 0}`,
    `sold_out=${m.reservation_sold_out?.count ?? 0}`,
    `lock_timeout=${m.reservation_lock_timeout?.count ?? 0}`,
    `unexpected=${m.reservation_unexpected_status?.count ?? 0}`,
  ].join("\t"));
}
'@ | node
```

Expected: 모든 Phase 4 summary row에 `p99`, `reserved`, `sold_out`, `lock_timeout`, `unexpected` 값이 나온다.

- [ ] **Step 2: Hikari summary에서 report table 값을 추출한다**

Run:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits -Recurse -Filter hikari-summary.json |
  Sort-Object FullName |
  ForEach-Object {
    $json = Get-Content -Raw -Encoding UTF8 -LiteralPath $_.FullName | ConvertFrom-Json
    "{0}`tpool={1}`tmaxMin={2}`tmaxMax={3}`tactiveMax={4}`tpendingMax={5}" -f `
      $_.FullName.Replace((Get-Location).Path + "\", ""), `
      $json.runWindow.pool, `
      $json.queries.hikariMaxMin.value, `
      $json.queries.hikariMaxMax.value, `
      $json.queries.hikariActiveMax.value, `
      $json.queries.hikariPendingMax.value
  }
```

Expected: `maxMin`과 `maxMax`는 `pool`과 같고, report에 들어갈 `Hikari Pending` 값은 `pendingMax`에서 가져온다. `activeMax`가 `maxMax`를 넘는 summary는 사용하지 않는다.

- [ ] **Step 3: `report.md`의 측정 출처 설명을 갱신한다**

`docs/phases/04-db-operational-limits/report.md` Summary의 측정값 출처를 아래 내용으로 바꾼다.

```markdown
측정값 출처는 다음과 같다.

- RPS, p95, p99, iterations, k6 HTTP failure rate는 k6 summary JSON에서 읽었다.
- `reserved`, `sold_out`, `lock_timeout`, `unexpected` 응답 수는 k6 custom counter에서 읽었다.
- Hikari Pending/Active/Max는 각 run-window의 `startedAt`~`endedAt` 본 실행 구간으로 생성한 `prometheus/hikari-summary.json`에서 읽었다.
- Seat Count Inconsistency와 Overbooking은 각 조건의 `sql/consistency.txt`를 기준으로 확인했다.
- Pessimistic Lock의 row lock wait는 `pg-lock-wait-snapshot.txt`, `pg-lock-summary.txt`, `pg-stat-activity.txt`로 확인했다.
- k6 threshold boolean은 pass/fail 판단 근거로 사용하지 않고, raw metric과 custom counter를 기준으로 해석했다.
```

기존 p95/p99 mixed-source caveat는 제거한다.

- [ ] **Step 4: Atomic Pool Result 표를 새 값으로 갱신한다**

Atomic 표의 `RPS`, `p95`, `p99`, `Hikari Pending`을 새 evidence 기준으로 갱신한다.

Evidence cell에는 다음을 연결한다.

- k6 summary JSON
- SQL consistency file
- Hikari summary JSON
- 대표 조건의 Grafana stitched dashboard

- [ ] **Step 5: Pessimistic Pool Result 표를 새 값과 lock evidence로 갱신한다**

Pessimistic 표의 `RPS`, `p95`, `p99`, `Hikari Pending`을 새 evidence 기준으로 갱신한다.

`pool-10`, `pool-50`의 Lock Wait Evidence는 새 파일로 연결한다. `pool-10`은 `pg-lock-wait-snapshot.txt`보다 `pg-stat-activity.txt`가 직접적인 Lock wait 증거이므로 함께 연결한다.

```markdown
[wait snapshot](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-wait-snapshot.txt),
[lock summary](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-summary.txt),
[pg_stat_activity](../../evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-stat-activity.txt)

[wait snapshot](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-wait-snapshot.txt),
[lock summary](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-summary.txt),
[pg_stat_activity](../../evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-stat-activity.txt)
```

- [ ] **Step 6: Pessimistic Timeout Result 표를 response counter 기준으로 갱신한다**

Timeout 표는 아래 컬럼을 포함한다.

```markdown
| Lock Timeout Setting | Reserved | Sold Out | Lock Timeout | Unexpected | p95 | p99 | Seat Count Inconsistency | Overbooking | Evidence |
```

`Reserved`, `Sold Out`, `Lock Timeout`, `Unexpected`은 k6 custom counter에서 읽는다.

`iterations - reserved`로 sold-out을 계산했다는 기존 설명은 삭제한다.

- [ ] **Step 7: timeout 해석을 관측 결과에 맞춰 쓴다**

`reservation_lock_timeout`이 0이면 아래 해석을 사용한다.

```markdown
이번 sold-out-dominant workload에서는 HTTP 408 `lock_timeout` 응답이 관측되지 않았다. 따라서 이 evidence만으로 `lock_timeout`이 긴 lock wait를 controlled failure로 바꾼다고 결론내릴 수 없다. 다만 408을 expected status로 분리하고 counter를 추가했으므로, 이후 timeout-stress 실험에서는 같은 경로로 controlled failure를 직접 검증할 수 있다.
```

`reservation_lock_timeout`이 1 이상이면 아래 해석을 사용한다.

```markdown
이번 timeout 조건에서는 HTTP 408 `lock_timeout` 응답이 k6 counter로 관측됐다. 이는 `lock_timeout`이 일부 긴 lock wait를 controlled failure로 전환했음을 보여준다. 다만 이 결과는 Phase 3/4 baseline workload의 성능 비교가 아니라 timeout guardrail 성격으로 해석한다.
```

- [ ] **Step 8: Decision 섹션의 baseline 선택 이유를 보강한다**

`Decision` 섹션에서 Phase 5 DB baseline을 Atomic Conditional Update로 둔 이유와 pool size 10을 보수적 운영 기준으로 둔 이유를 분리해 쓴다.

예시:

```markdown
Phase 5 Redis 비교의 DB baseline은 Atomic Conditional Update로 둔다. 같은 correctness 조건에서 Pessimistic Lock보다 처리량이 높고 row lock wait tail latency가 작기 때문이다.

- 보수적 운영 기준: Atomic Conditional Update, pool size 10
- 처리량 상한 참고 기준: Atomic Conditional Update, pool size 50

pool size 10은 이번 단일 실행의 최고 처리량 지점은 아니지만, active connection 수를 과도하게 늘리지 않으면서 invariant와 충분한 처리량을 유지하는 보수적 비교 기준으로 사용한다. pool size 50은 처리량 상한을 보는 참고 기준으로만 둔다.
```

- [ ] **Step 9: README status를 갱신한다**

`docs/phases/04-db-operational-limits/README.md`의 status를 아래 중 실제 상태로 바꾼다.

```markdown
## Status

Hardened
```

또는 timeout 408이 끝내 관측되지 않은 경우:

```markdown
## Status

Hardened with timeout limitation
```

- [ ] **Step 10: scope completion gate를 갱신한다**

`docs/phases/04-db-operational-limits/scope.md`의 completion gate를 evidence 상태에 맞게 체크한다.

예시:

```markdown
- [x] Atomic Conditional Update pool size별 k6 결과를 저장했다.
- [x] Pessimistic Lock pool size별 k6 결과를 저장했다.
- [x] Pessimistic Lock의 `pg_locks`, `pg_stat_activity` lock wait evidence를 저장했다.
- [x] `lock_timeout` 값별 HTTP 응답 분포와 p95/p99 결과를 저장했다.
- [x] 각 실험 후 consistency SQL 결과를 저장했다.
- [x] `report.md`에 DB pool/timeout 운영 기준을 기록했다.
```

timeout 응답이 0인 경우 gate는 “분포 저장 완료”로 체크하되, report 한계에 “timeout response not observed”를 명시한다.

- [ ] **Step 11: 문서 링크와 diff를 검증한다**

Run:

```powershell
rg -n "iterations - reserved|p95.*Prometheus|p99.*Prometheus|Not measured yet|Not recorded yet|Planned" docs/phases/04-db-operational-limits
git diff --check
```

Expected:

- `iterations - reserved` 없음
- p95/p99 mixed-source caveat 없음
- `Not measured yet`, `Not recorded yet` 없음
- README status에 `Planned` 없음
- 측정 출처에 threshold boolean을 raw metric 판단 근거로 쓰지 않았다는 문장 있음
- Pessimistic pool-10 lock evidence에 `pg-stat-activity.txt` 링크 있음
- `git diff --check` exit code `0`

- [ ] **Step 12: Commit**

```powershell
git add docs/phases/04-db-operational-limits/report.md `
        docs/phases/04-db-operational-limits/README.md `
        docs/phases/04-db-operational-limits/scope.md `
        docs/phases/04-db-operational-limits/observability.md
git commit -m "docs: harden phase4 operational limits report"
```
