# 001. Dashboard Generator

### Task 001: Generate Overview and Phase 2 Grafana Dashboards

**Files:**
- Create: `scripts/generate-grafana-dashboards.js`
- Create generated: `grafana/dashboards/concurrency-lab-overview.json`
- Create generated: `grafana/dashboards/phase-02-no-lock-baseline.json`

- [ ] **Step 1: Create the dashboard generator**

Create `scripts/generate-grafana-dashboards.js`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dashboardsDir = join(root, 'grafana/dashboards');
const datasource = { type: 'prometheus', uid: 'prometheus' };

const k6Filter = 'phase="$phase", scenario="$scenario", preset="$preset", pool="$pool"';
const apiUriFilter = 'uri=~"$uri", uri!="/actuator/prometheus", uri!="/**"';
const tableFilter = 'relname=~"$table"';

function zeroWhenNoData(expr) {
  return expr.includes('or vector(0)') ? expr : `(${expr}) or vector(0)`;
}

function createBuilder() {
  let nextPanelId = 1;
  let nextRefCode = 'A'.charCodeAt(0);

  function nextRefId() {
    const refId = String.fromCharCode(nextRefCode);
    nextRefCode += 1;
    return refId;
  }

  function target(expr, legendFormat = undefined) {
    return {
      datasource,
      editorMode: 'code',
      expr: zeroWhenNoData(expr),
      legendFormat,
      range: true,
      refId: nextRefId(),
    };
  }

  function row(title, y) {
    return {
      collapsed: false,
      gridPos: { h: 1, w: 24, x: 0, y },
      id: nextPanelId++,
      panels: [],
      title,
      type: 'row',
    };
  }

  function stat(title, expr, x, y, w = 6, unit = undefined) {
    return {
      datasource,
      fieldConfig: {
        defaults: {
          color: { mode: 'thresholds' },
          mappings: [],
          ...(unit ? { unit } : {}),
          thresholds: {
            mode: 'absolute',
            steps: [
              { color: 'green', value: null },
              { color: 'red', value: 80 },
            ],
          },
        },
        overrides: [],
      },
      gridPos: { h: 4, w, x, y },
      id: nextPanelId++,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        textMode: 'auto',
        wideLayout: true,
      },
      pluginVersion: '11.0.0',
      targets: [target(expr)],
      title,
      type: 'stat',
    };
  }

  function timeSeriesMulti(title, targets, x, y, w = 12, h = 8, overrides = [], tooltipMode = 'single') {
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
        overrides,
      },
      gridPos: { h, w, x, y },
      id: nextPanelId++,
      options: {
        legend: {
          calcs: ['lastNotNull'],
          displayMode: 'list',
          placement: 'bottom',
          showLegend: true,
        },
        tooltip: { mode: tooltipMode, sort: 'none' },
      },
      targets,
      title,
      type: 'timeseries',
    };
  }

  function timeSeries(title, expr, legendFormat, x, y, w = 12, h = 8) {
    return timeSeriesMulti(title, [target(expr, legendFormat)], x, y, w, h);
  }

  return { row, stat, target, timeSeries, timeSeriesMulti };
}

function variable(name, label, query, current, includeAll = false, multi = false) {
  return {
    current: {
      selected: includeAll,
      text: includeAll ? 'All' : current,
      value: includeAll ? '$__all' : current,
    },
    datasource,
    definition: query,
    includeAll,
    label,
    multi,
    name,
    options: [],
    query: {
      query,
      refId: 'PrometheusVariableQueryEditor-VariableQuery',
    },
    refresh: 1,
    sort: 1,
    type: 'query',
  };
}

function baseDashboard({ title, uid, tags, panels }) {
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
    templating: {
      list: [
        variable('phase', 'Phase', 'label_values(k6_http_reqs_total, phase)', 'phase-02'),
        variable('scenario', 'Scenario', 'label_values(k6_http_reqs_total{phase="$phase"}, scenario)', 'no-lock'),
        variable('preset', 'Preset', 'label_values(k6_http_reqs_total{phase="$phase", scenario="$scenario"}, preset)', 'baseline'),
        variable('pool', 'Pool', 'label_values(k6_http_reqs_total{phase="$phase", scenario="$scenario", preset="$preset"}, pool)', 'default'),
        variable('uri', 'URI', 'label_values(http_server_requests_seconds_count, uri)', '$__all', true, true),
        variable('table', 'Table', 'label_values(pg_stat_user_tables_seq_scan, relname)', '$__all', true, true),
      ],
    },
    time: { from: 'now-30m', to: 'now' },
    timepicker: {},
    timezone: 'browser',
    title,
    uid,
    version: 1,
    weekStart: '',
  };
}

function buildOverviewDashboard() {
  const b = createBuilder();
  const panels = [];
  let y = 0;

  panels.push(b.row('Run Summary', y));
  y += 1;
  panels.push(
    b.stat('k6 p95', `histogram_quantile(0.95, sum(rate(k6_http_req_duration_seconds{${k6Filter}}[$__rate_interval])))`, 0, y, 6, 's'),
    b.stat('k6 p99', `histogram_quantile(0.99, sum(rate(k6_http_req_duration_seconds{${k6Filter}}[$__rate_interval])))`, 6, y, 6, 's'),
    b.stat('Actual RPS', `sum(rate(k6_http_reqs_total{${k6Filter}}[$__rate_interval]))`, 12, y, 6, 'reqps'),
    b.stat('Error Rate', `avg(k6_http_req_failed_rate{${k6Filter}}) * 100`, 18, y, 6, 'percent'),
    b.stat('Checks Success', `avg(k6_checks_rate{${k6Filter}}) * 100`, 0, y + 4, 6, 'percent'),
    b.stat('Dropped Iterations', `sum(increase(k6_dropped_iterations_total{${k6Filter}}[$__range]))`, 6, y + 4, 6),
    b.stat('PG Connections Used', 'sum(pg_stat_database_numbackends) / max(pg_settings_max_connections) * 100', 12, y + 4, 6, 'percent'),
    b.stat('Hikari Pending Max', 'max(max_over_time(hikaricp_connections_pending[$__range]))', 18, y + 4, 6),
  );
  y += 8;

  panels.push(b.row('k6 Load', y));
  y += 1;
  panels.push(
    b.timeSeriesMulti('Performance Overview', [
      b.target(`sum(k6_vus{${k6Filter}})`, 'vus'),
      b.target(`sum(rate(k6_http_reqs_total{${k6Filter}}[$__rate_interval]))`, 'rps'),
      b.target(`sum(rate(k6_http_reqs_total{${k6Filter}, expected_response="false"}[$__rate_interval]))`, 'error_rps'),
      b.target(`histogram_quantile(0.95, sum(rate(k6_http_req_duration_seconds{${k6Filter}}[$__rate_interval])))`, 'p95_latency'),
    ], 0, y, 24, 10, [], 'multi'),
    b.timeSeriesMulti('HTTP Request Rate', [
      b.target(`sum(rate(k6_http_reqs_total{${k6Filter}, expected_response="true"}[$__rate_interval]))`, 'success_rps'),
      b.target(`sum(rate(k6_http_reqs_total{${k6Filter}, expected_response="false"}[$__rate_interval]))`, 'error_rps'),
    ], 0, y + 10, 12, 8, [], 'multi'),
    b.timeSeriesMulti('Latency and Iteration p95', [
      b.target(`histogram_quantile(0.95, sum(rate(k6_http_req_duration_seconds{${k6Filter}}[$__rate_interval])))`, 'http_p95'),
      b.target(`histogram_quantile(0.95, sum(rate(k6_iteration_duration_seconds{${k6Filter}}[$__rate_interval])))`, 'iteration_p95'),
    ], 12, y + 10, 12, 8, [], 'multi'),
    b.timeSeriesMulti('Checks Success Rate', [
      b.target(`avg by (check) (k6_checks_rate{${k6Filter}}) * 100`, '{{check}}'),
    ], 0, y + 18, 12, 8),
    b.timeSeries('Dropped Iterations', `sum(rate(k6_dropped_iterations_total{${k6Filter}}[$__rate_interval]))`, 'dropped', 12, y + 18, 12, 8),
  );
  y += 26;

  panels.push(b.row('Spring API', y));
  y += 1;
  panels.push(
    b.timeSeries('HTTP Request Rate by URI', `sum by (uri) (rate(http_server_requests_seconds_count{${apiUriFilter}}[$__rate_interval]))`, '{{uri}}', 0, y, 24),
    b.timeSeries('HTTP p95 by URI', `histogram_quantile(0.95, sum by (le, uri) (rate(http_server_requests_seconds_bucket{${apiUriFilter}}[$__rate_interval])))`, '{{uri}}', 0, y + 8, 12),
    b.timeSeries('HTTP Errors by Status', 'sum by (status) (rate(http_server_requests_seconds_count{status!~"2..", uri!="/actuator/prometheus", uri!="/**"}[$__rate_interval]))', '{{status}}', 12, y + 8, 12),
  );
  y += 16;

  panels.push(b.row('Spring Runtime', y));
  y += 1;
  panels.push(
    b.stat('Hikari Timeout Count', 'sum(increase(hikaricp_connections_timeout_total[$__range]))', 0, y, 6),
    b.stat('Heap Used', 'sum(jvm_memory_used_bytes{area="heap"}) * 100 / sum(jvm_memory_max_bytes{area="heap"})', 6, y, 6, 'percent'),
    b.timeSeries('Process CPU Usage', 'process_cpu_usage * 100', 'process_cpu', 12, y, 12, 8),
    b.timeSeries('GC Pause Time', 'sum(rate(jvm_gc_pause_seconds_sum[$__rate_interval]))', 'gc_pause', 0, y + 4, 12, 8),
  );
  y += 12;

  panels.push(b.row('Hikari Pool', y));
  y += 1;
  panels.push(
    b.timeSeries('Active Connections', 'hikaricp_connections_active', 'active', 0, y),
    b.timeSeries('Max Connections', 'hikaricp_connections_max', 'max', 12, y),
    b.timeSeries('Pending Threads', 'hikaricp_connections_pending', 'pending', 0, y + 8),
    b.timeSeries('Acquire Time', 'rate(hikaricp_connections_acquire_seconds_sum[$__rate_interval]) / rate(hikaricp_connections_acquire_seconds_count[$__rate_interval])', 'avg acquire', 12, y + 8),
  );
  y += 16;

  panels.push(b.row('PostgreSQL Activity', y));
  y += 1;
  panels.push(
    b.timeSeries('Active Sessions', 'sum(pg_stat_activity_count{state="active"})', 'active', 0, y),
    b.timeSeries('Locks', 'sum by (mode) (pg_locks_count)', '{{mode}}', 12, y),
    b.timeSeries('Commit Rate', 'rate(pg_stat_database_xact_commit[$__rate_interval])', 'commit', 0, y + 8),
    b.timeSeries('Rollback Rate', 'rate(pg_stat_database_xact_rollback[$__rate_interval])', 'rollback', 12, y + 8),
  );
  y += 16;

  panels.push(b.row('Table Access', y));
  y += 1;
  panels.push(
    b.timeSeries('Seq Scan by Table', `sum by (relname) (rate(pg_stat_user_tables_seq_scan{${tableFilter}}[$__rate_interval]))`, '{{relname}}', 0, y, 24),
    b.timeSeries('Index Scan by Table', `sum by (relname) (rate(pg_stat_user_tables_idx_scan{${tableFilter}}[$__rate_interval]))`, '{{relname}}', 0, y + 8, 24),
    b.timeSeries('Seq Tuples Read Rate by Table', `sum by (relname) (rate(pg_stat_user_tables_seq_tup_read{${tableFilter}}[$__rate_interval]))`, '{{relname}}', 0, y + 16),
    b.timeSeries('Index Tuples Fetch Rate by Table', `sum by (relname) (rate(pg_stat_user_tables_idx_tup_fetch{${tableFilter}}[$__rate_interval]))`, '{{relname}}', 12, y + 16),
  );

  return baseDashboard({
    title: 'Concurrency Lab Overview',
    uid: 'concurrency-lab-overview',
    tags: ['concurrency-lab', 'reservation', 'observability'],
    panels,
  });
}

function buildPhase2Dashboard() {
  const b = createBuilder();
  const panels = [];
  let y = 0;
  const reservationUri = 'uri="/api/reservations"';

  panels.push(b.row('Reservation Run Summary', y));
  y += 1;
  panels.push(
    b.stat('Reservation RPS', `sum(rate(http_server_requests_seconds_count{${reservationUri}}[$__rate_interval]))`, 0, y, 6, 'reqps'),
    b.stat('Reservation p95', `histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{${reservationUri}}[$__rate_interval])))`, 6, y, 6, 's'),
    b.stat('Reservation p99', `histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket{${reservationUri}}[$__rate_interval])))`, 12, y, 6, 's'),
    b.stat('5xx Rate', `sum(rate(http_server_requests_seconds_count{${reservationUri}, status=~"5.."}[$__rate_interval]))`, 18, y, 6, 'reqps'),
  );
  y += 4;

  panels.push(b.row('Consistency Snapshot', y));
  y += 1;
  panels.push(
    b.stat('Reservation Count', `max(concert_reservation_count{${k6Filter}})`, 0, y, 6),
    b.stat('Remaining Seats', `max(concert_remaining_seats{${k6Filter}})`, 6, y, 6),
    b.stat('Seat Count Inconsistency', `max(concert_seat_count_inconsistency{${k6Filter}})`, 12, y, 6),
    b.stat('Overbooked', `max(concert_overbooked{${k6Filter}})`, 18, y, 6),
  );
  y += 4;

  panels.push(b.row('k6 Baseline', y));
  y += 1;
  panels.push(
    b.timeSeriesMulti('k6 VUs, RPS, Errors, p95', [
      b.target(`sum(k6_vus{${k6Filter}})`, 'vus'),
      b.target(`sum(rate(k6_http_reqs_total{${k6Filter}}[$__rate_interval]))`, 'rps'),
      b.target(`sum(rate(k6_http_reqs_total{${k6Filter}, expected_response="false"}[$__rate_interval]))`, 'error_rps'),
      b.target(`histogram_quantile(0.95, sum(rate(k6_http_req_duration_seconds{${k6Filter}}[$__rate_interval])))`, 'p95_latency'),
    ], 0, y, 24, 10, [], 'multi'),
    b.timeSeriesMulti('Checks by Name', [
      b.target(`avg by (check) (k6_checks_rate{${k6Filter}}) * 100`, '{{check}}'),
    ], 0, y + 10, 12, 8),
    b.timeSeries('Dropped Iterations', `sum(rate(k6_dropped_iterations_total{${k6Filter}}[$__rate_interval]))`, 'dropped', 12, y + 10),
  );
  y += 18;

  panels.push(b.row('DB Pressure', y));
  y += 1;
  panels.push(
    b.timeSeries('Hikari Active', 'hikaricp_connections_active', 'active', 0, y),
    b.timeSeries('Hikari Pending', 'hikaricp_connections_pending', 'pending', 12, y),
    b.timeSeries('Hikari Acquire Time', 'rate(hikaricp_connections_acquire_seconds_sum[$__rate_interval]) / rate(hikaricp_connections_acquire_seconds_count[$__rate_interval])', 'avg acquire', 0, y + 8),
    b.timeSeries('PostgreSQL Locks', 'sum by (mode) (pg_locks_count)', '{{mode}}', 12, y + 8),
  );
  y += 16;

  panels.push(b.row('Table Focus', y));
  y += 1;
  panels.push(
    b.timeSeries('Concert and Reservation Seq Scan', 'sum by (relname) (rate(pg_stat_user_tables_seq_scan{relname=~"concert|reservation"}[$__rate_interval]))', '{{relname}}', 0, y, 12),
    b.timeSeries('Concert and Reservation Index Scan', 'sum by (relname) (rate(pg_stat_user_tables_idx_scan{relname=~"concert|reservation"}[$__rate_interval]))', '{{relname}}', 12, y, 12),
  );

  return baseDashboard({
    title: 'Phase 2 No Lock Baseline',
    uid: 'phase-02-no-lock-baseline',
    tags: ['concurrency-lab', 'phase-02', 'no-lock'],
    panels,
  });
}

function writeDashboard(fileName, dashboard) {
  mkdirSync(dashboardsDir, { recursive: true });
  const outputPath = join(dashboardsDir, fileName);
  writeFileSync(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(`Generated ${outputPath}`);
}

writeDashboard('concurrency-lab-overview.json', buildOverviewDashboard());
writeDashboard('phase-02-no-lock-baseline.json', buildPhase2Dashboard());
```

- [ ] **Step 2: Generate dashboards**

Run:

```bash
npm run grafana:generate
```

Expected:

```text
Generated .../grafana/dashboards/concurrency-lab-overview.json
Generated .../grafana/dashboards/phase-02-no-lock-baseline.json
```

- [ ] **Step 3: Validate generated JSON**

Run:

```bash
node -e "for (const f of ['grafana/dashboards/concurrency-lab-overview.json','grafana/dashboards/phase-02-no-lock-baseline.json']) { const d = JSON.parse(require('fs').readFileSync(f, 'utf8')); console.log(f, d.title, d.uid, d.panels.length); }"
```

Expected:

- overview title is `Concurrency Lab Overview`
- overview uid is `concurrency-lab-overview`
- Phase 2 title is `Phase 2 No Lock Baseline`
- Phase 2 uid is `phase-02-no-lock-baseline`
- each dashboard has more than zero panels

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-grafana-dashboards.js grafana/dashboards/concurrency-lab-overview.json grafana/dashboards/phase-02-no-lock-baseline.json
git commit -m "chore: generate grafana dashboards"
```
