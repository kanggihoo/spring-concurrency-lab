# Grafana Dashboard Generator YAML Refactor Implementation Plan - 005 Generation Entrypoint and Artifacts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YAML spec을 실제 `grafana/dashboards/concurrency-lab-overview.json`으로 생성하는 entrypoint를 추가하고, 기존 generator 파일은 호환 wrapper로 전환한다.

**Architecture:** `scripts/grafana/generate.js`는 dashboard spec, row specs, query specs를 로드하고 compiler를 실행한다. `write-dashboard.js`는 output path 검증과 JSON 쓰기만 담당한다.

**Tech Stack:** Node.js ESM, YAML loader, Grafana dashboard JSON.

---

## Task 005: Generation Entrypoint and Artifacts

**Files:**

- Create: `scripts/grafana/generate.js`
- Create: `scripts/grafana/lib/write-dashboard.js`
- Modify: `scripts/generate-grafana-dashboards.js`
- Modify: `grafana/dashboards/concurrency-lab-overview.json`
- Delete: `grafana/dashboards/phase-02-no-lock-baseline.json`

- [ ] **Step 1: dashboard writer를 작성한다**

Create `scripts/grafana/lib/write-dashboard.js`:

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export async function writeDashboard({ root, dashboardsDir, output, dashboard }) {
  if (!output || output.includes('/') || output.includes('\\')) {
    throw new Error(`Dashboard output must be a file name: ${output}`);
  }

  const outputPath = resolve(dashboardsDir, output);
  if (!isPathInside(dashboardsDir, outputPath)) {
    throw new Error(`Dashboard output must resolve inside ${dashboardsDir}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dashboard, null, 2)}\n`);
  console.log(`Generated ${relative(root, outputPath)}`);
}

function isPathInside(parent, child) {
  const childRelativePath = relative(parent, child);
  return childRelativePath === '' || (!childRelativePath.startsWith('..') && !isAbsolute(childRelativePath));
}

export function outputPathFor({ dashboardsDir, output }) {
  return join(dashboardsDir, output);
}
```

- [ ] **Step 2: YAML generator entrypoint를 작성한다**

Create `scripts/grafana/generate.js`:

```js
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
```

- [ ] **Step 3: 기존 generator를 wrapper로 바꾼다**

Replace `scripts/generate-grafana-dashboards.js` with:

```js
import './grafana/generate.js';
```

- [ ] **Step 4: YAML 기반 generator 테스트를 실행한다**

Run:

```bash
npm run grafana:test
npm run grafana:generate
```

Expected:

```text
# fail 0
Generated grafana/dashboards/concurrency-lab-overview.json
```

- [ ] **Step 5: Phase 2 전용 generated JSON을 제거한다**

Run:

```bash
rm grafana/dashboards/phase-02-no-lock-baseline.json
```

Expected:

```text
No output
```

- [ ] **Step 6: generated overview dashboard를 검증한다**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs');
const dashboard = JSON.parse(fs.readFileSync('grafana/dashboards/concurrency-lab-overview.json', 'utf8'));
const variables = dashboard.templating.list.map((variable) => variable.name);
const panelTitles = dashboard.panels.map((panel) => panel.title);

console.log(`uid=${dashboard.uid}`);
console.log(`variables=${variables.join(',')}`);
console.log(`panels=${dashboard.panels.length}`);
console.log(`hasReservationConsistency=${panelTitles.includes('Reservation Consistency')}`);
NODE
```

Expected:

```text
uid=concurrency-lab-overview
variables=phase,scenario,preset,pool,uri,table
panels=44
hasReservationConsistency=true
```

- [ ] **Step 7: 커밋한다**

```bash
git add \
  scripts/grafana/generate.js \
  scripts/grafana/lib/write-dashboard.js \
  scripts/generate-grafana-dashboards.js \
  grafana/dashboards/concurrency-lab-overview.json
git rm grafana/dashboards/phase-02-no-lock-baseline.json
git commit -m "refactor: generate grafana dashboards from yaml"
```
