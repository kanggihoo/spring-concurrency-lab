import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDashboard } from './lib/dashboard-compiler.js';
import { buildQueryRegistry } from './lib/query-registry.js';
import { loadYamlDirectory } from './lib/yaml-loader.js';
import { writeDashboard } from './lib/write-dashboard.js';

const grafanaScriptsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(grafanaScriptsDir, '../..');
const dashboardsDir = resolve(root, 'grafana/dashboards');

async function main() {
  const dashboardDocs = await loadYamlDirectory(resolve(grafanaScriptsDir, 'dashboards'));
  const rowDocs = await loadYamlDirectory(resolve(grafanaScriptsDir, 'rows'));
  const queryDocs = await loadYamlDirectory(resolve(grafanaScriptsDir, 'queries'));

  const rows = new Map();
  for (const { document } of rowDocs) {
    if (!document.id) {
      throw new Error('Grafana row YAML must define id');
    }
    if (rows.has(document.id)) {
      throw new Error(`Duplicate Grafana row id: ${document.id}`);
    }
    rows.set(document.id, document);
  }

  const queryRegistry = buildQueryRegistry(queryDocs.map(({ document }) => document));

  for (const { document: dashboardSpec } of dashboardDocs) {
    const dashboard = compileDashboard({ dashboardSpec, rows, queryRegistry });
    await writeDashboard({
      root,
      dashboardsDir,
      output: dashboardSpec.output,
      dashboard,
    });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
