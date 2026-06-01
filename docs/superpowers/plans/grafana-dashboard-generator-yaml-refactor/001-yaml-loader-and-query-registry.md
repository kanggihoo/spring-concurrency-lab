# Grafana Dashboard Generator YAML Refactor Implementation Plan - 001 YAML Loader and Query Registry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YAML 파일을 안전하게 읽고, `queries/*.yml`의 PromQL alias를 중복 없이 registry로 만드는 기반을 추가한다.

**Architecture:** `yaml-loader.js`는 파일 시스템과 YAML parsing만 담당한다. `query-registry.js`는 query document validation, duplicate key detection, `or on() vector(0)` fallback 처리를 담당한다.

**Tech Stack:** Node.js ESM, `yaml`, Node built-in test runner, `node:assert/strict`.

---

## Task 001: YAML Loader and Query Registry

**Files:**

- Create: `scripts/grafana/lib/yaml-loader.js`
- Create: `scripts/grafana/lib/query-registry.js`
- Create: `scripts/grafana/lib/query-registry.test.js`

- [ ] **Step 1: query registry 테스트를 먼저 작성한다**

Create `scripts/grafana/lib/query-registry.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueryRegistry, getQuery, withNoDataFallback } from './query-registry.js';

test('buildQueryRegistry indexes query aliases from multiple YAML documents', () => {
  const registry = buildQueryRegistry([
    {
      'k6.http.p95': {
        expr: 'max(k6_http_req_duration_p95{phase="$phase"})',
        zeroWhenNoData: true,
      },
    },
    {
      'hikari.active': {
        expr: 'hikaricp_connections_active',
      },
    },
  ]);

  assert.equal(getQuery(registry, 'k6.http.p95').expr, 'max(k6_http_req_duration_p95{phase="$phase"})');
  assert.equal(getQuery(registry, 'k6.http.p95').zeroWhenNoData, true);
  assert.equal(getQuery(registry, 'hikari.active').zeroWhenNoData, true);
});

test('buildQueryRegistry rejects duplicate query aliases', () => {
  assert.throws(
    () => buildQueryRegistry([
      { 'k6.http.rps': { expr: 'sum(rate(k6_http_reqs_total[$__rate_interval]))' } },
      { 'k6.http.rps': { expr: 'sum(k6_http_reqs_total)' } },
    ]),
    /Duplicate Grafana query alias: k6\.http\.rps/,
  );
});

test('buildQueryRegistry rejects invalid query definitions', () => {
  assert.throws(
    () => buildQueryRegistry([{ 'k6.http.rps': { zeroWhenNoData: true } }]),
    /Grafana query k6\.http\.rps must define a non-empty expr/,
  );
});

test('getQuery rejects unknown aliases with a useful message', () => {
  const registry = buildQueryRegistry([{ 'k6.http.rps': { expr: 'sum(k6_http_reqs_total)' } }]);

  assert.throws(
    () => getQuery(registry, 'missing.query'),
    /Unknown Grafana query alias: missing\.query/,
  );
});

test('withNoDataFallback wraps expressions once', () => {
  assert.equal(
    withNoDataFallback('sum(rate(k6_http_reqs_total[$__rate_interval]))'),
    '(sum(rate(k6_http_reqs_total[$__rate_interval]))) or on() vector(0)',
  );
  assert.equal(
    withNoDataFallback('(sum(k6_http_reqs_total)) or on() vector(0)'),
    '(sum(k6_http_reqs_total)) or on() vector(0)',
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
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../scripts/grafana/lib/query-registry.js
```

- [ ] **Step 3: YAML loader를 작성한다**

Create `scripts/grafana/lib/yaml-loader.js`:

```js
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

export async function loadYamlFile(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`YAML file must contain an object: ${filePath}`);
  }
  return parsed;
}

export async function loadYamlDirectory(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')))
    .map((entry) => join(dirPath, entry.name))
    .sort();

  const documents = [];
  for (const file of files) {
    documents.push({
      file,
      document: await loadYamlFile(file),
    });
  }
  return documents;
}
```

- [ ] **Step 4: query registry를 작성한다**

Create `scripts/grafana/lib/query-registry.js`:

```js
export function buildQueryRegistry(documents) {
  const registry = new Map();

  for (const document of documents) {
    for (const [alias, definition] of Object.entries(document)) {
      if (registry.has(alias)) {
        throw new Error(`Duplicate Grafana query alias: ${alias}`);
      }
      if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
        throw new Error(`Grafana query ${alias} must be an object`);
      }
      if (typeof definition.expr !== 'string' || definition.expr.trim() === '') {
        throw new Error(`Grafana query ${alias} must define a non-empty expr`);
      }
      registry.set(alias, {
        expr: definition.expr,
        zeroWhenNoData: definition.zeroWhenNoData !== false,
      });
    }
  }

  return registry;
}

export function getQuery(registry, alias) {
  const query = registry.get(alias);
  if (!query) {
    throw new Error(`Unknown Grafana query alias: ${alias}`);
  }
  return query;
}

export function withNoDataFallback(expr) {
  return expr.includes('or on() vector(0)') ? expr : `(${expr}) or on() vector(0)`;
}
```

- [ ] **Step 5: query registry 테스트가 통과하는지 확인한다**

Run:

```bash
npm run grafana:test
```

Expected:

```text
# pass 5
# fail 0
```

- [ ] **Step 6: 커밋한다**

```bash
git add \
  scripts/grafana/lib/yaml-loader.js \
  scripts/grafana/lib/query-registry.js \
  scripts/grafana/lib/query-registry.test.js
git commit -m "feat: add grafana query registry"
```
