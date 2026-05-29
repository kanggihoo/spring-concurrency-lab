# 002. Hikari Prometheus Summary Evidence

### Task 002: run-window의 본 실행 구간 기준 Hikari metric summary exporter 추가

**Files:**
- Create: `scripts/export-hikari-summary.js`
- Modify: `package.json`
- Modify: `docs/phases/04-db-operational-limits/runbook.md`
- Generate in Task 003: `docs/evidence/04-db-operational-limits/**/prometheus/hikari-summary.json`

- [ ] **Step 1: Hikari summary exporter를 만든다**

Create `scripts/export-hikari-summary.js`:

```javascript
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function parseArgs(argv) {
  const args = {
    prometheusUrl: "http://localhost:9090",
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--run-window") {
      args.runWindow = value;
      i += 1;
    } else if (arg === "--out") {
      args.out = value;
      i += 1;
    } else if (arg === "--prometheus-url") {
      args.prometheusUrl = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.runWindow) throw new Error("--run-window is required");
  if (!args.out) throw new Error("--out is required");

  return args;
}

function secondsRange(fromMs, toMs) {
  return `${Math.max(1, Math.ceil((toMs - fromMs) / 1000))}s`;
}

async function queryPrometheus(baseUrl, query, timeSeconds) {
  const url = new URL("/api/v1/query", baseUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("time", String(timeSeconds));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Prometheus query failed: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  if (body.status !== "success") {
    throw new Error(`Prometheus returned non-success status: ${JSON.stringify(body)}`);
  }

  return body.data.result;
}

function firstValue(result) {
  if (!Array.isArray(result) || result.length === 0) return null;
  const value = result[0]?.value?.[1];
  if (value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function requireNumber(name, value) {
  if (value === null) {
    throw new Error(`${name} is null. Prometheus has no Hikari sample in the k6 execution window.`);
  }
  return value;
}

const args = parseArgs(process.argv);
const runWindow = JSON.parse(readFileSync(args.runWindow, "utf8"));
const evidenceRange = secondsRange(runWindow.startedAt, runWindow.endedAt);
const grafanaRange = secondsRange(runWindow.grafanaFrom, runWindow.grafanaTo);
const queryTime = Math.floor(runWindow.endedAt / 1000);

const queries = {
  hikariMaxMin: `min_over_time(hikaricp_connections_max[${evidenceRange}])`,
  hikariMaxMax: `max_over_time(hikaricp_connections_max[${evidenceRange}])`,
  hikariActiveMax: `max(max_over_time(hikaricp_connections_active[${evidenceRange}]))`,
  hikariPendingMax: `max(max_over_time(hikaricp_connections_pending[${evidenceRange}]))`,
};

const output = {
  runWindow: {
    path: args.runWindow,
    phase: runWindow.phase,
    scenario: runWindow.scenario,
    preset: runWindow.preset,
    pool: runWindow.pool,
    mode: runWindow.mode,
    startedAt: runWindow.startedAt,
    endedAt: runWindow.endedAt,
    grafanaFrom: runWindow.grafanaFrom,
    grafanaTo: runWindow.grafanaTo,
    evidenceRange,
    grafanaRange,
    queryTime,
  },
  prometheusUrl: args.prometheusUrl,
  queries: {},
};

for (const [name, query] of Object.entries(queries)) {
  const result = await queryPrometheus(args.prometheusUrl, query, queryTime);
  output.queries[name] = {
    query,
    value: firstValue(result),
    rawResult: result,
  };
}

const expectedPool = Number(runWindow.pool);
const hikariMaxMin = requireNumber("hikariMaxMin", output.queries.hikariMaxMin.value);
const hikariMaxMax = requireNumber("hikariMaxMax", output.queries.hikariMaxMax.value);
const hikariActiveMax = requireNumber("hikariActiveMax", output.queries.hikariActiveMax.value);

if (hikariMaxMin !== expectedPool || hikariMaxMax !== expectedPool) {
  throw new Error(
    `Hikari max does not match run-window pool: pool=${expectedPool}, min=${hikariMaxMin}, max=${hikariMaxMax}`,
  );
}

if (hikariActiveMax > hikariMaxMax) {
  throw new Error(`Hikari active max exceeds Hikari max: active=${hikariActiveMax}, max=${hikariMaxMax}`);
}

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`wrote ${args.out}`);
```

- [ ] **Step 2: npm script를 등록한다**

`package.json`의 `scripts`에 아래 항목을 추가한다.

```json
"prometheus:hikari-summary": "node scripts/export-hikari-summary.js"
```

- [ ] **Step 3: exporter 문법을 검증한다**

Run:

```powershell
node --check scripts/export-hikari-summary.js
```

Expected: exit code `0`.

- [ ] **Step 4: 실제 run-window 하나로 exporter를 검증한다**

Prometheus가 실행 중이고 기존 run-window가 있을 때 실행한다.

Run:

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-10/prometheus/hikari-summary.json
```

Expected:

```text
wrote docs/evidence/04-db-operational-limits/atomic-pool/pool-10/prometheus/hikari-summary.json
```

`hikari-summary.json`에는 `hikariMaxMin`, `hikariMaxMax`, `hikariActiveMax`, `hikariPendingMax`가 들어간다. exporter는 `grafanaFrom`/`grafanaTo` 패딩 구간이 아니라 k6 본 실행 구간인 `startedAt`/`endedAt`만 사용한다. 과거 Prometheus 데이터가 사라져 값이 `null`이면 실패시키고, 실제 Phase 4 재실행 때 다시 생성한다.

`hikariMaxMin`과 `hikariMaxMax`는 모두 `runWindow.pool`과 같아야 한다. 이 검증은 다음 실행의 scrape가 run-window 패딩 구간에 섞여 `hikariMax`가 한 조건씩 밀리는 문제를 막기 위한 것이다.

- [ ] **Step 5: runbook에 Hikari summary 수집 절차를 추가한다**

`docs/phases/04-db-operational-limits/runbook.md`에 아래 절을 추가한다.

````markdown
## Hikari Prometheus Summary

각 k6 실행 후 run-window JSON의 `startedAt`~`endedAt` 본 실행 구간을 기준으로 HikariCP aggregate evidence를 저장한다. `grafanaFrom`~`grafanaTo`는 dashboard 표시용 패딩 구간이므로 Hikari summary 계산에 사용하지 않는다.

```powershell
$runWindow = (Get-ChildItem docs/evidence/04-db-operational-limits/atomic-pool/pool-10/grafana/run-window-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-10/prometheus/hikari-summary.json
```

저장된 값은 Grafana screenshot이 아니라 `report.md`의 Hikari table 값 source of truth로 사용한다. `hikariMaxMin`/`hikariMaxMax`가 실행 pool size와 다르면 해당 summary는 폐기하고 exporter 또는 run-window를 수정한다.
````

- [ ] **Step 6: 변경 사항을 검증한다**

Run:

```powershell
npm run prometheus:hikari-summary -- --run-window "$runWindow" --out docs/evidence/04-db-operational-limits/atomic-pool/pool-10/prometheus/hikari-summary.json
git diff --check
```

Expected: exporter 실행과 `git diff --check` 모두 exit code `0`.

- [ ] **Step 7: Commit**

```powershell
git add scripts/export-hikari-summary.js package.json docs/phases/04-db-operational-limits/runbook.md
git commit -m "feat: export hikari prometheus summary evidence"
```
