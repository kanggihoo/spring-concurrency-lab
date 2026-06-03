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
