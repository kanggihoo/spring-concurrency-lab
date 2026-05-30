# 002. Prometheus Raw Query와 PostgreSQL Lock Evidence 도구

### Task 002: Phase 3 Prometheus exporter와 lock snapshot SQL 추가

**Files:**
- Create: `scripts/export-phase3-prometheus-evidence.js`
- Create: `scripts/sql/pg-stat-activity-phase3.sql`
- Create: `scripts/sql/pg-lock-summary.sql`
- Modify: `package.json`

- [ ] **Step 1: Prometheus exporter 파일을 생성한다**

`scripts/export-phase3-prometheus-evidence.js`를 아래 내용으로 생성한다.

```javascript
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const strategies = new Map([
  ["pessimistic-lock", { scenario: "pessimistic" }],
  ["optimistic-lock", { scenario: "optimistic" }],
  ["atomic-update", { scenario: "atomic" }],
]);

function parseArgs(argv) {
  const args = {
    prometheusUrl: "http://localhost:9090",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--strategy") args.strategy = argv[++i];
    else if (value === "--run-window") args.runWindow = argv[++i];
    else if (value === "--out-dir") args.outDir = argv[++i];
    else if (value === "--prometheus-url") args.prometheusUrl = argv[++i];
    else throw new Error(`Unknown argument: ${value}`);
  }

  if (!strategies.has(args.strategy)) {
    throw new Error("--strategy must be pessimistic-lock, optimistic-lock, or atomic-update");
  }
  if (!args.runWindow) {
    throw new Error("--run-window is required");
  }
  if (!args.outDir) {
    throw new Error("--out-dir is required");
  }

  return args;
}

function secondsBetween(startedAt, endedAt) {
  return Math.max(1, Math.ceil((endedAt - startedAt) / 1000));
}

function labelsFor(window, scenario) {
  const phase = window.phase || "phase-03";
  const preset = window.preset || "baseline";
  const pool = window.pool || "default";
  return `{phase="${phase}",scenario="${scenario}",preset="${preset}",pool="${pool}"}`;
}

async function queryPrometheus(prometheusUrl, query, timeSeconds) {
  const url = new URL("/api/v1/query", prometheusUrl);
  url.searchParams.set("query", query);
  url.searchParams.set("time", String(timeSeconds));

  const response = await fetch(url);
  const body = await response.json();

  return {
    request: {
      url: url.toString(),
      query,
      time: timeSeconds,
    },
    response: body,
    extractedValue: extractSingleValue(body),
  };
}

function extractSingleValue(body) {
  const result = body?.data?.result;
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const value = result[0]?.value?.[1];
  if (value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const args = parseArgs(process.argv.slice(2));
const strategy = strategies.get(args.strategy);
const runWindow = JSON.parse(readFileSync(args.runWindow, "utf8"));
const evidenceRangeSeconds = secondsBetween(runWindow.startedAt, runWindow.endedAt);
const queryTimeSeconds = Math.ceil(runWindow.endedAt / 1000);
const labelSelector = labelsFor(runWindow, strategy.scenario);
const range = `${evidenceRangeSeconds}s`;
const outDir = resolve(args.outDir);

const k6Summary = {
  strategy: args.strategy,
  runWindowPath: args.runWindow,
  range,
  queries: {
    k6HttpRequests: await queryPrometheus(
      args.prometheusUrl,
      `sum(increase(k6_http_reqs_total${labelSelector}[${range}]))`,
      queryTimeSeconds,
    ),
    k6HttpReqDurationP99Max: await queryPrometheus(
      args.prometheusUrl,
      `max(max_over_time(k6_http_req_duration_p99${labelSelector}[${range}]))`,
      queryTimeSeconds,
    ),
  },
};

writeJson(`${outDir}/k6-window-summary.json`, k6Summary);

if (args.strategy === "optimistic-lock") {
  writeJson(`${outDir}/optimistic-retry-total.json`, {
    strategy: args.strategy,
    runWindowPath: args.runWindow,
    range,
    query: await queryPrometheus(
      args.prometheusUrl,
      `sum(increase(reservation_optimistic_retry_total[${range}]))`,
      queryTimeSeconds,
    ),
  });
}

if (args.strategy === "pessimistic-lock") {
  writeJson(`${outDir}/pg-locks-count.json`, {
    strategy: args.strategy,
    runWindowPath: args.runWindow,
    range,
    query: await queryPrometheus(
      args.prometheusUrl,
      `max(max_over_time(pg_locks_count[${range}]))`,
      queryTimeSeconds,
    ),
  });
}

console.log(`phase3 prometheus evidence exported: ${outDir}`);
```

- [ ] **Step 2: PostgreSQL activity snapshot SQL을 생성한다**

`scripts/sql/pg-stat-activity-phase3.sql`을 아래 내용으로 생성한다.

```sql
SELECT
    pid,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_age,
    now() - xact_start AS xact_age,
    pg_blocking_pids(pid) AS blocking_pids,
    query
FROM pg_stat_activity
WHERE datname = 'reservation'
ORDER BY query_age DESC NULLS LAST, pid;
```

- [ ] **Step 3: PostgreSQL lock summary SQL을 생성한다**

`scripts/sql/pg-lock-summary.sql`을 아래 내용으로 생성한다.

```sql
SELECT
    locktype,
    relation::regclass AS relation,
    mode,
    granted,
    count(*) AS count
FROM pg_locks
WHERE relation IS NOT NULL
GROUP BY locktype, relation, mode, granted
ORDER BY granted, count DESC, mode;
```

- [ ] **Step 4: npm script를 등록한다**

`package.json`의 `scripts`에 아래 항목을 추가한다.

```json
"prometheus:phase3": "node scripts/export-phase3-prometheus-evidence.js"
```

추가 후 scripts 영역은 아래 키들을 포함해야 한다.

```json
{
  "grafana:generate": "node scripts/generate-grafana-dashboards.js",
  "grafana:capture": "node scripts/capture-grafana-dashboard.js",
  "grafana:capture:phase2": "node scripts/capture-grafana-dashboard.js --dashboard phase2 --phase phase-02 --scenario no-lock --preset baseline --pool default --run-window auto",
  "grafana:stitch": "python scripts/stitch-grafana-captures.py",
  "grafana:stitch:phase2": "python scripts/stitch-grafana-captures.py --phase 02-no-lock-baseline",
  "k6:verify-reservation-responses": "node scripts/verify-k6-reservation-responses.js",
  "prometheus:phase3": "node scripts/export-phase3-prometheus-evidence.js"
}
```

- [ ] **Step 5: syntax 검증을 실행한다**

Run:

```bash
rtk node --check scripts/export-phase3-prometheus-evidence.js
rtk node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8")); console.log("package json ok")'
rtk git diff --check
```

Expected:

```text
package json ok
```

`node --check`와 `git diff --check`는 exit code `0`.

- [ ] **Step 6: Commit**

Run:

```bash
rtk git add scripts/export-phase3-prometheus-evidence.js scripts/sql/pg-stat-activity-phase3.sql scripts/sql/pg-lock-summary.sql package.json
rtk git commit -m "feat: add phase3 prometheus and lock evidence tools"
```

Expected:

```text
[... feat: add phase3 prometheus and lock evidence tools]
```
