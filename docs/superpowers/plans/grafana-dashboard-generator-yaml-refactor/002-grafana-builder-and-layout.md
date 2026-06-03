# Grafana Dashboard Generator YAML Refactor Implementation Plan - 002 Grafana Builder and Layout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YAML panel spec을 Grafana panel JSON으로 바꿀 때 사용할 panel builder와 자동 grid layout 계산기를 추가한다.

**Architecture:** `layout.js`는 panel 위치 계산만 담당한다. `grafana-builder.js`는 Grafana datasource, target, row, stat, timeseries, variable, base dashboard JSON 구조를 생성한다.

**Tech Stack:** Node.js ESM, Grafana dashboard JSON, Node built-in test runner.

---

## Task 002: Grafana Builder and Layout

**Files:**

- Create: `scripts/grafana/lib/layout.js`
- Create: `scripts/grafana/lib/grafana-builder.js`
- Create: `scripts/grafana/lib/layout.test.js`

- [ ] **Step 1: layout 테스트를 먼저 작성한다**

Create `scripts/grafana/lib/layout.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { assignGridPositions, defaultPanelSize } from './layout.js';

test('defaultPanelSize returns stable defaults by panel type', () => {
  assert.deepEqual(defaultPanelSize({ type: 'stat' }), { w: 6, h: 4 });
  assert.deepEqual(defaultPanelSize({ type: 'timeseries' }), { w: 12, h: 8 });
});

test('assignGridPositions fills stat panels left to right', () => {
  const result = assignGridPositions([
    { type: 'stat', title: 'A' },
    { type: 'stat', title: 'B' },
    { type: 'stat', title: 'C' },
    { type: 'stat', title: 'D' },
    { type: 'stat', title: 'E' },
  ], 1);

  assert.deepEqual(result.panels.map((panel) => panel.gridPos), [
    { x: 0, y: 1, w: 6, h: 4 },
    { x: 6, y: 1, w: 6, h: 4 },
    { x: 12, y: 1, w: 6, h: 4 },
    { x: 18, y: 1, w: 6, h: 4 },
    { x: 0, y: 5, w: 6, h: 4 },
  ]);
  assert.equal(result.nextY, 9);
});

test('assignGridPositions uses shortest-column packing for mixed heights', () => {
  const result = assignGridPositions([
    { type: 'stat', title: 'Heap Used' },
    { type: 'stat', title: 'Thread Count' },
    { type: 'timeseries', title: 'Process CPU Usage' },
    { type: 'timeseries', title: 'GC Pause Time' },
  ], 30);

  assert.deepEqual(result.panels.map((panel) => panel.gridPos), [
    { x: 0, y: 30, w: 6, h: 4 },
    { x: 6, y: 30, w: 6, h: 4 },
    { x: 12, y: 30, w: 12, h: 8 },
    { x: 0, y: 34, w: 12, h: 8 },
  ]);
  assert.equal(result.nextY, 42);
});

test('assignGridPositions honors explicit width and height', () => {
  const result = assignGridPositions([
    { type: 'timeseries', title: 'Performance Overview', w: 24, h: 10 },
    { type: 'timeseries', title: 'HTTP Request Rate' },
  ], 10);

  assert.deepEqual(result.panels.map((panel) => panel.gridPos), [
    { x: 0, y: 10, w: 24, h: 10 },
    { x: 0, y: 20, w: 12, h: 8 },
  ]);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run:

```bash
npm run grafana:test
```

Expected:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../scripts/grafana/lib/layout.js
```

- [ ] **Step 3: layout 계산기를 작성한다**

Create `scripts/grafana/lib/layout.js`:

```js
const GRID_WIDTH = 24;

export function defaultPanelSize(panel) {
  if (panel.type === 'stat') return { w: 6, h: 4 };
  if (panel.type === 'timeseries') return { w: 12, h: 8 };
  throw new Error(`Unsupported Grafana panel type: ${panel.type}`);
}

export function assignGridPositions(panelSpecs, startY) {
  const columnHeights = Array(GRID_WIDTH).fill(startY);
  const panels = [];

  for (const panel of panelSpecs) {
    const size = defaultPanelSize(panel);
    const w = panel.w ?? panel.layout?.w ?? size.w;
    const h = panel.h ?? panel.layout?.h ?? size.h;
    if (!Number.isInteger(w) || w <= 0 || w > GRID_WIDTH) {
      throw new Error(`Invalid panel width for ${panel.title}: ${w}`);
    }
    if (!Number.isInteger(h) || h <= 0) {
      throw new Error(`Invalid panel height for ${panel.title}: ${h}`);
    }

    const { x, y } = findPlacement(columnHeights, w);
    for (let i = x; i < x + w; i += 1) {
      columnHeights[i] = y + h;
    }
    panels.push({
      ...panel,
      gridPos: { x, y, w, h },
    });
  }

  return {
    panels,
    nextY: Math.max(...columnHeights),
  };
}

function findPlacement(columnHeights, width) {
  const candidates = [...new Set(columnHeights)].sort((a, b) => a - b);
  for (const y of candidates) {
    for (let x = 0; x <= GRID_WIDTH - width; x += 1) {
      if (columnHeights.slice(x, x + width).every((height) => height <= y)) {
        return { x, y };
      }
    }
  }

  const y = Math.min(...columnHeights);
  for (let x = 0; x <= GRID_WIDTH - width; x += 1) {
    if (columnHeights.slice(x, x + width).every((height) => height <= y)) {
      return { x, y };
    }
  }

  throw new Error(`Unable to place Grafana panel with width ${width}`);
}
```

- [ ] **Step 4: Grafana builder를 작성한다**

Create `scripts/grafana/lib/grafana-builder.js`:

```js
import { withNoDataFallback } from './query-registry.js';

export const datasource = { type: 'prometheus', uid: 'prometheus' };

export function createBuilder() {
  let nextPanelId = 1;
  let nextRefIndex = 0;

  function nextRefId() {
    let index = nextRefIndex;
    let refId = '';
    do {
      refId = String.fromCharCode('A'.charCodeAt(0) + (index % 26)) + refId;
      index = Math.floor(index / 26) - 1;
    } while (index >= 0);
    nextRefIndex += 1;
    return refId;
  }

  function target(query, legendFormat) {
    const expr = query.zeroWhenNoData === false ? query.expr : withNoDataFallback(query.expr);
    return {
      datasource,
      editorMode: 'code',
      expr,
      legendFormat,
      range: true,
      refId: nextRefId(),
    };
  }

  function row(title, gridPos) {
    return {
      collapsed: false,
      gridPos,
      id: nextPanelId++,
      panels: [],
      title,
      type: 'row',
    };
  }

  function stat(spec, targets) {
    return {
      datasource,
      fieldConfig: {
        defaults: {
          color: { mode: 'thresholds' },
          mappings: [],
          ...(spec.unit ? { unit: spec.unit } : {}),
          thresholds: {
            mode: 'absolute',
            steps: [
              { color: 'green', value: null },
              { color: 'red', value: 80 },
            ],
          },
        },
        overrides: spec.overrides ?? [],
      },
      gridPos: spec.gridPos,
      id: nextPanelId++,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        orientation: 'auto',
        reduceOptions: {
          calcs: [spec.calc ?? 'lastNotNull'],
          fields: '',
          values: false,
        },
        textMode: 'auto',
        wideLayout: true,
      },
      pluginVersion: '11.0.0',
      targets,
      title: spec.title,
      type: 'stat',
    };
  }

  function timeSeries(spec, targets) {
    return {
      datasource,
      fieldConfig: {
        defaults: {
          color: { mode: 'palette-classic' },
          custom: {
            axisBorderShow: false,
            axisCenteredZero: false,
            axisColorMode: 'text',
            axisLabel: '',
            axisPlacement: 'auto',
            barAlignment: 0,
            drawStyle: 'line',
            fillOpacity: 10,
            gradientMode: 'none',
            hideFrom: { legend: false, tooltip: false, viz: false },
            insertNulls: false,
            lineInterpolation: 'linear',
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: { type: 'linear' },
            showPoints: 'never',
            spanNulls: false,
            stacking: { group: 'A', mode: 'none' },
            thresholdsStyle: { mode: 'off' },
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              { color: 'green', value: null },
              { color: 'red', value: 80 },
            ],
          },
        },
        overrides: spec.overrides ?? [],
      },
      gridPos: spec.gridPos,
      id: nextPanelId++,
      options: {
        legend: {
          calcs: ['lastNotNull'],
          displayMode: 'list',
          placement: 'bottom',
          showLegend: true,
        },
        tooltip: { mode: spec.tooltipMode ?? 'single', sort: 'none' },
      },
      targets,
      title: spec.title,
      type: 'timeseries',
    };
  }

  return { row, stat, target, timeSeries };
}

export function variable(name, spec) {
  const includeAll = spec.includeAll === true;
  return {
    current: {
      selected: includeAll,
      text: includeAll ? 'All' : spec.default,
      value: includeAll ? '$__all' : spec.default,
    },
    datasource,
    definition: spec.query,
    includeAll,
    label: spec.label,
    multi: spec.multi === true,
    name,
    options: [],
    query: {
      query: spec.query,
      refId: 'PrometheusVariableQueryEditor-VariableQuery',
    },
    refresh: 1,
    sort: 1,
    type: 'query',
  };
}

export function baseDashboard({ title, uid, tags, panels, variables }) {
  return {
    annotations: {
      list: [
        {
          builtIn: 1,
          datasource: { type: 'grafana', uid: '-- Grafana --' },
          enable: true,
          hide: true,
          iconColor: 'rgba(0, 211, 255, 1)',
          name: 'Annotations & Alerts',
          type: 'dashboard',
        },
      ],
    },
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    id: null,
    links: [],
    panels,
    refresh: '10s',
    schemaVersion: 39,
    tags,
    templating: { list: variables },
    time: { from: 'now-30m', to: 'now' },
    timepicker: {},
    timezone: 'browser',
    title,
    uid,
    version: 1,
    weekStart: '',
  };
}
```

- [ ] **Step 5: layout 테스트가 통과하는지 확인한다**

Run:

```bash
npm run grafana:test
```

Expected:

```text
# fail 0
```

- [ ] **Step 6: 커밋한다**

```bash
git add \
  scripts/grafana/lib/layout.js \
  scripts/grafana/lib/grafana-builder.js \
  scripts/grafana/lib/layout.test.js
git commit -m "feat: add grafana dashboard layout builder"
```
