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
