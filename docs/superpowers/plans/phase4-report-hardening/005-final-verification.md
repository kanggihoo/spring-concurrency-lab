# 005. 최종 검증

### Task 005: Phase 4 hardening 완료 검증

**Files:**
- Read: `docs/phases/04-db-operational-limits/report.md`
- Read: `docs/evidence/04-db-operational-limits/**`
- Read: `docs/superpowers/specs/2026-05-29-phase4-report-hardening-design.md`

- [ ] **Step 1: k6 summary가 p99와 response counters를 모두 포함하는지 확인한다**

Run:

```powershell
@'
const fs = require("fs");
const path = require("path");

const report = "docs/phases/04-db-operational-limits/report.md";
const reportDir = path.dirname(report);
const reportText = fs.readFileSync(report, "utf8");
const files = [...reportText.matchAll(/\[k6\]\((\.\.\/\.\.\/[^)]+-summary\.json)\)/g)]
  .map((match) => path.resolve(reportDir, match[1]));

let failures = 0;
if (files.length !== 13) {
  console.error(`expected 13 report-linked k6 summaries, got ${files.length}`);
  failures += 1;
}

for (const file of files) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const metrics = json.metrics;
  const missing = [];
  if (metrics.http_req_duration?.["p(99)"] === undefined) missing.push("http_req_duration.p(99)");
  for (const name of ["reservation_reserved", "reservation_sold_out", "reservation_lock_timeout", "reservation_unexpected_status"]) {
    if (!metrics[name]) missing.push(name);
  }
  if (missing.length > 0) {
    console.error(`${file}: missing ${missing.join(", ")}`);
    failures += 1;
  }
}
if (failures > 0) process.exit(1);
console.log("phase4 k6 summaries ok");
'@ | node
```

Expected:

```text
phase4 k6 summaries ok
```

- [ ] **Step 2: Hikari summary evidence가 모든 condition에 있고 pool size와 일치하는지 확인한다**

Run:

```powershell
$conditions = @(
  "atomic-pool/pool-2",
  "atomic-pool/pool-5",
  "atomic-pool/pool-10",
  "atomic-pool/pool-20",
  "atomic-pool/pool-50",
  "pessimistic-pool/pool-2",
  "pessimistic-pool/pool-5",
  "pessimistic-pool/pool-10",
  "pessimistic-pool/pool-20",
  "pessimistic-pool/pool-50",
  "pessimistic-timeout/timeout-200",
  "pessimistic-timeout/timeout-500",
  "pessimistic-timeout/timeout-1000"
)

$missing = @()
foreach ($condition in $conditions) {
  $path = "docs/evidence/04-db-operational-limits/$condition/prometheus/hikari-summary.json"
  if (-not (Test-Path $path)) { $missing += $path }
}

if ($missing.Count -gt 0) {
  $missing
  exit 1
}

"hikari summaries ok"
```

Expected:

```text
hikari summaries ok
```

Run:

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
  const pendingMax = Number(json.queries?.hikariPendingMax?.value);

  const invalid =
    !Number.isFinite(pool) ||
    !Number.isFinite(maxMin) ||
    !Number.isFinite(maxMax) ||
    !Number.isFinite(activeMax) ||
    !Number.isFinite(pendingMax) ||
    pool !== maxMin ||
    pool !== maxMax ||
    activeMax > maxMax;

  if (invalid) {
    console.error(`${file}: pool=${pool}, hikariMaxMin=${maxMin}, hikariMaxMax=${maxMax}, activeMax=${activeMax}, pendingMax=${pendingMax}`);
    failures += 1;
  }
}

if (failures > 0) process.exit(1);
console.log("hikari summary values ok");
'@ | node
```

Expected:

```text
hikari summary values ok
```

- [ ] **Step 3: Pessimistic representative lock evidence가 있는지 확인한다**

Run:

```powershell
Test-Path docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-wait-snapshot.txt
Test-Path docs/evidence/04-db-operational-limits/pessimistic-pool/pool-10/sql/pg-lock-summary.txt
Test-Path docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-wait-snapshot.txt
Test-Path docs/evidence/04-db-operational-limits/pessimistic-pool/pool-50/sql/pg-lock-summary.txt
```

Expected: 네 줄 모두 `True`.

- [ ] **Step 4: consistency evidence가 invariant를 만족하는지 확인한다**

Run:

```powershell
Get-ChildItem docs/evidence/04-db-operational-limits -Recurse -Filter consistency.txt |
  Sort-Object FullName |
  ForEach-Object {
    $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $_.FullName
    if ($content -notmatch "100\\s+\\|\\s+0\\s+\\|\\s+0\\s+\\|\\s+f") {
      Write-Error "unexpected consistency result: $($_.FullName)"
      exit 1
    }
  }
"consistency ok"
```

Expected:

```text
consistency ok
```

- [ ] **Step 5: report에 약한 표현이 남아 있지 않은지 확인한다**

Run:

```powershell
rg -n "iterations - reserved|p95.*Prometheus|p99.*Prometheus|Not measured yet|Not recorded yet|Planned|snapshot 미수집" docs/phases/04-db-operational-limits/report.md docs/phases/04-db-operational-limits/README.md docs/phases/04-db-operational-limits/scope.md
```

Expected: 검색 결과 없음.

Run:

```powershell
rg -n "threshold boolean|pg-stat-activity.txt|pool size 10" docs/phases/04-db-operational-limits/report.md
```

Expected: threshold 판단 기준, Pessimistic pool-10 lock evidence, Phase 5 baseline pool size 10 선택 이유가 검색된다.

- [ ] **Step 6: 전체 검증 명령을 실행한다**

Run:

```powershell
npm run k6:verify-reservation-responses
node --check scripts/export-hikari-summary.js
git diff --check
```

Expected: 모두 exit code `0`.

- [ ] **Step 7: 최종 변경 파일을 확인한다**

Run:

```powershell
git status --short
```

Expected: Phase 4 hardening과 관련된 파일만 staged 또는 unstaged 상태다. 기존 사용자 변경이 섞여 있으면 되돌리지 말고 final note에 별도로 언급한다.

- [ ] **Step 8: Commit**

```powershell
git add docs/evidence/04-db-operational-limits `
        docs/phases/04-db-operational-limits `
        k6 `
        scripts `
        package.json
git commit -m "docs: complete phase4 report hardening"
```
