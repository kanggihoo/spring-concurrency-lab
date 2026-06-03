# 003. Phase 4 재실행과 Evidence 수집

### Task 003: 보강된 k6 summary와 신규 evidence로 Phase 4 matrix 재실행

**Files:**
- Generate: `docs/evidence/04-db-operational-limits/atomic-pool/**`
- Generate: `docs/evidence/04-db-operational-limits/pessimistic-pool/**`
- Generate: `docs/evidence/04-db-operational-limits/pessimistic-timeout/**`

- [ ] **Step 1: 공통 인프라를 실행한다**

Run:

```powershell
make db-start
```

Expected: `postgres`, `postgres_exporter`, `prometheus`, `grafana` 컨테이너가 실행된다.

- [ ] **Step 2: Atomic pool matrix를 재실행한다**

각 pool size마다 서버를 재시작한 뒤 k6, SQL consistency, Hikari summary를 저장한다. Hikari summary exporter는 `run-window`의 `startedAt`~`endedAt` 본 실행 구간만 사용하며, `hikariMaxMin`/`hikariMaxMax`가 `runWindow.pool`과 다르면 실패해야 한다.

```powershell
make server-start POOL_SIZE=2
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-2 PRESET=phase4-atomic-pool POOL=2 CONDITION=pool-2
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-2
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-2/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-2/prometheus/hikari-summary.json
```

Run:

```powershell
make server-start POOL_SIZE=5
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-5 PRESET=phase4-atomic-pool POOL=5 CONDITION=pool-5
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-5
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-5/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-5/prometheus/hikari-summary.json

make server-start POOL_SIZE=10
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-10 PRESET=phase4-atomic-pool POOL=10 CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-10/prometheus/hikari-summary.json

make server-start POOL_SIZE=20
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-20 PRESET=phase4-atomic-pool POOL=20 CONDITION=pool-20
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-20
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-20/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-20/prometheus/hikari-summary.json

make server-start POOL_SIZE=50
make k6-evidence PHASE=04-db-operational-limits/atomic-pool/pool-50 PRESET=phase4-atomic-pool POOL=50 CONDITION=pool-50
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-50
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-50/prometheus/hikari-summary.json
```

- [ ] **Step 3: Atomic summary에 p99와 response counters가 있는지 확인한다**

Run:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool -Recurse -Filter "*summary.json" |
  Where-Object { $_.FullName -like "*\k6\*" } |
  Select-String '"p\(99\)"|"reservation_reserved"|"reservation_sold_out"|"reservation_unexpected_status"'
```

Expected: 각 summary JSON에서 `p(99)`, `reservation_reserved`, `reservation_sold_out`, `reservation_unexpected_status`가 검색된다.

- [ ] **Step 4: Pessimistic pool matrix를 재실행한다**

`pool-2`, `pool-5`, `pool-20`은 k6, SQL consistency, Hikari summary를 저장한다. Hikari summary가 pool size와 일치하지 않으면 다음 조건으로 넘어가지 말고 exporter 시간 범위와 server-start 상태를 먼저 확인한다.

```powershell
make server-start POOL_SIZE=2
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-2 PRESET=phase4-pessimistic-pool POOL=2 CONDITION=pool-2
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-2
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-pool/pool-2/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-pool/pool-2/prometheus/hikari-summary.json

make server-start POOL_SIZE=5
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-5 PRESET=phase4-pessimistic-pool POOL=5 CONDITION=pool-5
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-5
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-pool/pool-5/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-pool/pool-5/prometheus/hikari-summary.json

make server-start POOL_SIZE=20
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-20 PRESET=phase4-pessimistic-pool POOL=20 CONDITION=pool-20
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-20
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-pool/pool-20/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-pool/pool-20/prometheus/hikari-summary.json
```

- [ ] **Step 5: Pessimistic pool-10에서 lock evidence를 k6 실행 중 캡처한다**

터미널 A:

```powershell
make server-start POOL_SIZE=10
```

터미널 B:

```powershell
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-10 PRESET=phase4-pessimistic-pool POOL=10 CONDITION=pool-10
```

터미널 C에서 k6가 실행 중일 때:

```powershell
New-Item -ItemType Directory -Force docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql

docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-wait-snapshot.sql `
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-wait-snapshot.txt

docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-summary.sql `
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-summary.txt
```

k6 종료 후:

```powershell
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-10
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/prometheus/hikari-summary.json
```

- [ ] **Step 6: Pessimistic pool-50에서 lock evidence를 k6 실행 중 캡처한다**

터미널 A:

```powershell
make server-start POOL_SIZE=50
```

터미널 B:

```powershell
make k6-evidence PHASE=04-db-operational-limits/pessimistic-pool/pool-50 PRESET=phase4-pessimistic-pool POOL=50 CONDITION=pool-50
```

터미널 C에서 k6가 실행 중일 때:

```powershell
New-Item -ItemType Directory -Force docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql

docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-wait-snapshot.sql `
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-wait-snapshot.txt

docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/pg-lock-summary.sql `
  > docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-summary.txt
```

k6 종료 후:

```powershell
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-50
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/prometheus/hikari-summary.json
```

Expected: `pg-lock-wait-snapshot.txt`에 `Lock` wait event 또는 `blocking_pids`가 포함된다. 순간 캡처 타이밍상 0 row이면 같은 k6 실행 중 한 번 더 캡처한다.

- [ ] **Step 7: Pessimistic timeout matrix를 재실행한다**

각 timeout마다 서버를 `POOL_SIZE=10`으로 재시작한다.

```powershell
make server-start POOL_SIZE=10 LOCK_TIMEOUT=200
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-200 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-200
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-200
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-200/prometheus/hikari-summary.json
```

Run:

```powershell
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-500 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-500
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-500
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-500/prometheus/hikari-summary.json

make server-start POOL_SIZE=10 LOCK_TIMEOUT=1000
make k6-evidence PHASE=04-db-operational-limits/pessimistic-timeout/timeout-1000 PRESET=phase4-pessimistic-timeout POOL=10 CONDITION=timeout-1000
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-1000
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/pessimistic-timeout/timeout-1000/prometheus/hikari-summary.json
```

- [ ] **Step 8: 대표 Grafana dashboard를 다시 캡처한다**

대표 조건:

- Atomic: `pool-2`, `pool-10`, `pool-50`
- Pessimistic pool: `pool-2`, `pool-10`, `pool-50`
- Timeout: `timeout-500`

예시:

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
make grafana-capture DASHBOARD=overview GRAFANA_PHASE=phase-04 SCENARIO=atomic PRESET=pool-limit POOL=50 RUN_WINDOW="$runWindow" PARTS_DIR=docs/evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/parts
make evidence-postprocess PHASE=04-db-operational-limits/atomic-pool/pool-50 OUTPUT=docs/evidence/04-db-operational-limits/atomic-pool/pool-50/grafana/stitched-dashboard.png
```

- [ ] **Step 9: evidence 존재를 검증한다**

Run:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits -Recurse -Filter "*summary.json" |
  Where-Object { $_.FullName -like "*\k6\*" } |
  Measure-Object
Get-ChildItem docs/evidence/04-db-operational-limits -Recurse -Filter "hikari-summary.json" | Measure-Object
Get-ChildItem docs/evidence/04-db-operational-limits -Recurse -Filter "consistency.txt" | Measure-Object
Test-Path docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-wait-snapshot.txt
Test-Path docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-summary.txt
```

Expected:

- summary JSON: 13개 이상
- hikari-summary JSON: 13개 이상
- consistency.txt: 13개 이상
- 두 `Test-Path` 결과가 `True`

추가로 Hikari summary의 내부 일관성을 확인한다.

```powershell
@'
const fs = require("fs");
const path = require("path");

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name === "hikari-summary.json") files.push(full);
  }
  return files;
}

let failures = 0;
for (const file of walk("docs/evidence/04-db-operational-limits").sort()) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const pool = Number(json.runWindow?.pool);
  const maxMin = Number(json.queries?.hikariMaxMin?.value);
  const maxMax = Number(json.queries?.hikariMaxMax?.value);
  const activeMax = Number(json.queries?.hikariActiveMax?.value);
  if (pool !== maxMin || pool !== maxMax || activeMax > maxMax) {
    console.error(`${file}: pool=${pool}, hikariMaxMin=${maxMin}, hikariMaxMax=${maxMax}, activeMax=${activeMax}`);
    failures += 1;
  }
}
if (failures > 0) process.exit(1);
console.log("hikari summary consistency ok");
'@ | node
```

Expected:

```text
hikari summary consistency ok
```

- [ ] **Step 10: Commit**

```powershell
git add docs/evidence/04-db-operational-limits
git commit -m "docs: rerun phase4 hardened evidence"
```
