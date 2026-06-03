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
