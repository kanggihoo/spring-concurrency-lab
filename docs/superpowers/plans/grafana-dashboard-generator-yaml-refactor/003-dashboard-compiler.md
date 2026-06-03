# Grafana Dashboard Generator YAML Refactor Implementation Plan - 003 Dashboard Compiler

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dashboard YAML, row YAML, query registry를 조합해 Grafana dashboard JSON object를 만드는 compiler를 추가한다.

**Architecture:** `dashboard-compiler.js`는 validation과 orchestration만 담당한다. Row order는 dashboard spec이 결정하고, panel 위치는 `layout.js`, panel JSON 구조는 `grafana-builder.js`, PromQL 조회는 `query-registry.js`가 담당한다.

**Tech Stack:** Node.js ESM, Grafana dashboard JSON, Node built-in test runner.

---

## Task 003: Dashboard Compiler

**Files:**

- Create: `scripts/grafana/lib/dashboard-compiler.js`
- Create: `scripts/grafana/lib/dashboard-compiler.test.js`

- [ ] **Step 1: compiler 테스트를 먼저 작성한다**

Create `scripts/grafana/lib/dashboard-compiler.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileDashboard } from './dashboard-compiler.js';
import { buildQueryRegistry } from './query-registry.js';

test('compileDashboard builds rows, variables, panels, and targets', () => {
  const dashboardSpec = {
    uid: 'concurrency-lab-overview',
    title: 'Concurrency Lab Overview',
    tags: ['concurrency-lab'],
    variables: {
      phase: {
        label: 'Phase',
        query: 'label_values(k6_http_reqs_total, phase)',
        default: 'phase-02',
      },
    },
    rows: ['run-summary'],
  };
  const rows = new Map([
    ['run-summary', {
      id: 'run-summary',
      title: 'Run Summary',
      panels: [
        { type: 'stat', title: 'k6 p95', query: 'k6.http.p95', unit: 's', calc: 'max' },
        {
          type: 'timeseries',
          title: 'Performance Overview',
          w: 24,
          h: 10,
          targets: [
            { query: 'k6.vus', legend: 'vus' },
            { query: 'k6.http.rps', legend: 'rps' },
          ],
          tooltipMode: 'multi',
        },
      ],
    }],
  ]);
  const registry = buildQueryRegistry([
    {
      'k6.http.p95': { expr: 'max(k6_http_req_duration_p95{phase="$phase"})' },
      'k6.vus': { expr: 'sum(k6_vus{phase="$phase"})' },
      'k6.http.rps': { expr: 'sum(rate(k6_http_reqs_total{phase="$phase"}[$__rate_interval]))' },
    },
  ]);

  const dashboard = compileDashboard({ dashboardSpec, rows, queryRegistry: registry });

  assert.equal(dashboard.uid, 'concurrency-lab-overview');
  assert.equal(dashboard.templating.list[0].name, 'phase');
  assert.equal(dashboard.panels[0].type, 'row');
  assert.equal(dashboard.panels[0].title, 'Run Summary');
  assert.equal(dashboard.panels[1].title, 'k6 p95');
  assert.equal(dashboard.panels[1].targets[0].refId, 'A');
  assert.match(dashboard.panels[1].targets[0].expr, /or on\(\) vector\(0\)$/);
  assert.equal(dashboard.panels[2].targets[0].refId, 'B');
  assert.equal(dashboard.panels[2].targets[1].refId, 'C');
  assert.equal(dashboard.panels[2].options.tooltip.mode, 'multi');
});

test('compileDashboard rejects unknown row ids', () => {
  const registry = buildQueryRegistry([{ 'k6.http.rps': { expr: 'sum(k6_http_reqs_total)' } }]);

  assert.throws(
    () => compileDashboard({
      dashboardSpec: { uid: 'x', title: 'X', tags: [], variables: {}, rows: ['missing-row'] },
      rows: new Map(),
      queryRegistry: registry,
    }),
    /Unknown Grafana row id: missing-row/,
  );
});

test('compileDashboard rejects panels without query or targets', () => {
  const registry = buildQueryRegistry([{ 'k6.http.rps': { expr: 'sum(k6_http_reqs_total)' } }]);
  const rows = new Map([
    ['broken', { id: 'broken', title: 'Broken', panels: [{ type: 'stat', title: 'Broken' }] }],
  ]);

  assert.throws(
    () => compileDashboard({
      dashboardSpec: { uid: 'x', title: 'X', tags: [], variables: {}, rows: ['broken'] },
      rows,
      queryRegistry: registry,
    }),
    /Panel Broken must define query or targets/,
  );
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run:

```bash
npm run grafana:test
```

Expected:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../scripts/grafana/lib/dashboard-compiler.js
```

- [ ] **Step 3: dashboard compiler를 작성한다**

Create `scripts/grafana/lib/dashboard-compiler.js`:

```js
import { assignGridPositions } from './layout.js';
import { baseDashboard, createBuilder, variable } from './grafana-builder.js';
import { getQuery } from './query-registry.js';

export function compileDashboard({ dashboardSpec, rows, queryRegistry }) {
  validateDashboardSpec(dashboardSpec);

  const builder = createBuilder();
  const panels = [];
  let y = 0;

  for (const rowId of dashboardSpec.rows) {
    const rowSpec = rows.get(rowId);
    if (!rowSpec) {
      throw new Error(`Unknown Grafana row id: ${rowId}`);
    }

    panels.push(builder.row(rowSpec.title, { h: 1, w: 24, x: 0, y }));
    y += 1;

    const positioned = assignGridPositions(rowSpec.panels ?? [], y);
    for (const panelSpec of positioned.panels) {
      const targets = resolveTargets(panelSpec, queryRegistry, builder);
      if (panelSpec.type === 'stat') {
        panels.push(builder.stat(panelSpec, targets));
      } else if (panelSpec.type === 'timeseries') {
        panels.push(builder.timeSeries(panelSpec, targets));
      } else {
        throw new Error(`Unsupported Grafana panel type: ${panelSpec.type}`);
      }
    }
    y = positioned.nextY;
  }

  return baseDashboard({
    title: dashboardSpec.title,
    uid: dashboardSpec.uid,
    tags: dashboardSpec.tags ?? [],
    variables: Object.entries(dashboardSpec.variables ?? {}).map(([name, spec]) => variable(name, spec)),
    panels,
  });
}

function resolveTargets(panelSpec, queryRegistry, builder) {
  if (panelSpec.query) {
    return [builder.target(getQuery(queryRegistry, panelSpec.query), panelSpec.legend)];
  }

  if (Array.isArray(panelSpec.targets) && panelSpec.targets.length > 0) {
    return panelSpec.targets.map((targetSpec) => {
      if (!targetSpec.query) {
        throw new Error(`Panel ${panelSpec.title} target must define query`);
      }
      return builder.target(getQuery(queryRegistry, targetSpec.query), targetSpec.legend);
    });
  }

  throw new Error(`Panel ${panelSpec.title} must define query or targets`);
}

function validateDashboardSpec(dashboardSpec) {
  if (!dashboardSpec || typeof dashboardSpec !== 'object') {
    throw new Error('Dashboard spec must be an object');
  }
  for (const field of ['uid', 'title']) {
    if (typeof dashboardSpec[field] !== 'string' || dashboardSpec[field].trim() === '') {
      throw new Error(`Dashboard spec must define ${field}`);
    }
  }
  if (!Array.isArray(dashboardSpec.rows)) {
    throw new Error('Dashboard spec must define rows as an array');
  }
}
```

- [ ] **Step 4: compiler 테스트가 통과하는지 확인한다**

Run:

```bash
npm run grafana:test
```

Expected:

```text
# fail 0
```

- [ ] **Step 5: 커밋한다**

```bash
git add \
  scripts/grafana/lib/dashboard-compiler.js \
  scripts/grafana/lib/dashboard-compiler.test.js
git commit -m "feat: compile grafana dashboard yaml"
```
