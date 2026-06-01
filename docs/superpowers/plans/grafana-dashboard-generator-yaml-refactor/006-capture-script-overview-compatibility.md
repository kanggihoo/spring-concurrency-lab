# Grafana Dashboard Generator YAML Refactor Implementation Plan - 006 Capture Script Overview Compatibility

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2 전용 dashboard 제거 후에도 Grafana capture 명령이 overview dashboard를 기준으로 동작하게 정리한다.

**Architecture:** Capture script는 계속 전체 dashboard scroll capture 도구다. `overview`를 기본 dashboard로 사용하고, 기존 `phase2` dashboard 이름은 `overview`로 해석하는 호환 alias로 유지한다.

**Tech Stack:** Node.js ESM, Playwright, Makefile, npm scripts.

---

## Task 006: Capture Script Overview Compatibility

**Files:**

- Modify: `scripts/capture-grafana-dashboard.js`
- Modify: `package.json`
- Modify: `Makefile`

- [ ] **Step 1: capture script dashboard registry를 overview 중심으로 바꾼다**

Modify the top of `scripts/capture-grafana-dashboard.js` so the dashboard map and defaults become:

```js
const dashboards = {
  overview: {
    uid: 'concurrency-lab-overview',
    slug: 'concurrency-lab-overview',
  },
  phase2: {
    uid: 'concurrency-lab-overview',
    slug: 'concurrency-lab-overview',
    aliasFor: 'overview',
  },
};

const defaults = {
  dashboard: 'overview',
  baseUrl: 'http://localhost:3000',
  selector: '[data-testid="data-testid DashboardEditPaneSplitter body container"]',
  partsDir: 'docs/evidence/02-no-lock-baseline/grafana/parts',
  viewportWidth: 1600,
  viewportHeight: 965,
  waitMs: 1000,
  phase: 'phase-02',
  scenario: 'no-lock',
  preset: 'baseline',
  pool: 'default',
  uri: '$__all',
  table: '$__all',
  from: 'now-30m',
  to: 'now',
  refresh: '10s',
  live: false,
  runWindow: 'auto',
};
```

- [ ] **Step 2: run-window auto lookup을 partsDir 기준으로 바꾼다**

Replace `defaultRunWindowDir(args)` in `scripts/capture-grafana-dashboard.js` with:

```js
function defaultRunWindowDir(args) {
  return dirname(resolve(root, args.partsDir));
}
```

This keeps Phase 2 defaults working because the default `partsDir` parent is `docs/evidence/02-no-lock-baseline/grafana`.

- [ ] **Step 3: dashboard URL 생성에서 alias metadata를 추가한다**

Modify `buildDashboardUrl(args)` to keep using `dashboards[args.dashboard]`, but the URL should always come from the resolved dashboard object:

```js
function buildDashboardUrl(args) {
  const dashboard = dashboards[args.dashboard];
  if (!dashboard) {
    throw new Error(`Unsupported dashboard: ${args.dashboard}`);
  }

  if (!args.live && (args.from === 'now-30m' || args.to === 'now')) {
    throw new Error('Live capture requires --live. Pass explicit --from/--to for fixed evidence windows.');
  }

  const url = new URL(`/d/${dashboard.uid}/${dashboard.slug}`, args.baseUrl);
  url.searchParams.set('orgId', '1');
  url.searchParams.set('from', args.from);
  url.searchParams.set('to', args.to);
  url.searchParams.set('timezone', 'browser');
  url.searchParams.set('var-phase', args.phase);
  url.searchParams.set('var-scenario', args.scenario);
  url.searchParams.set('var-preset', args.preset);
  url.searchParams.set('var-pool', args.pool);
  url.searchParams.set('var-uri', args.uri);
  url.searchParams.set('var-table', args.table);
  url.searchParams.set('refresh', args.refresh);
  return url.toString();
}
```

Modify the metadata block so the existing `dashboard` string remains compatible and the resolved name is added separately:

```js
dashboard: args.dashboard,
dashboardResolved: dashboards[args.dashboard].aliasFor || args.dashboard,
```

- [ ] **Step 4: help text를 갱신한다**

In `printHelp()`, update the dashboard line to:

```text
  --dashboard <overview|phase2>  Dashboard to capture, phase2 is an overview compatibility alias
```

- [ ] **Step 5: package script와 Makefile 기본값을 overview로 바꾼다**

Modify `package.json`:

```json
{
  "scripts": {
    "grafana:capture:phase2": "node scripts/capture-grafana-dashboard.js --dashboard overview --phase phase-02 --scenario no-lock --preset baseline --pool default --run-window auto"
  }
}
```

Modify `Makefile` default:

```make
DASHBOARD ?= overview
```

Modify the help line:

```make
	@echo "  make grafana-capture DASHBOARD=overview RUN_WINDOW=auto TABLE=concert"
```

- [ ] **Step 6: capture CLI compatibility를 검증한다**

Run:

```bash
npm run grafana:capture -- --help
node - <<'NODE'
import { spawnSync } from 'node:child_process';
const result = spawnSync('node', ['scripts/capture-grafana-dashboard.js', '--dashboard', 'missing', '--run-window', '0', '--live'], { encoding: 'utf8' });
console.log(result.status);
console.log(result.stderr.trim());
NODE
```

Expected:

```text
Usage: node scripts/capture-grafana-dashboard.js [options]
1
Unsupported dashboard: missing
```

- [ ] **Step 7: 커밋한다**

```bash
git add scripts/capture-grafana-dashboard.js package.json package-lock.json Makefile
git commit -m "refactor: capture overview dashboard by default"
```
