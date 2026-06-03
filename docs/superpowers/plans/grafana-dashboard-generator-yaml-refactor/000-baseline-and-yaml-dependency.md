# Grafana Dashboard Generator YAML Refactor Implementation Plan - 000 Baseline and YAML Dependency

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 dashboard 생성 결과를 기준선으로 확인하고 YAML parser dependency와 test command를 추가한다.

**Architecture:** 기존 generator는 아직 변경하지 않는다. 먼저 `yaml` package와 `grafana:test` npm script를 추가해서 이후 단계의 YAML loader와 compiler 테스트를 실행할 기반을 만든다.

**Tech Stack:** Node.js ESM, npm, `yaml`, Node built-in test runner.

---

## Task 000: Baseline and YAML Dependency

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 현재 dashboard baseline을 확인한다**

Run:

```bash
npm run grafana:generate
node - <<'NODE'
const fs = require('node:fs');
for (const file of [
  'grafana/dashboards/concurrency-lab-overview.json',
  'grafana/dashboards/phase-02-no-lock-baseline.json',
]) {
  const dashboard = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`${file} title=${dashboard.title} uid=${dashboard.uid} panels=${dashboard.panels.length}`);
}
NODE
```

Expected:

```text
grafana/dashboards/concurrency-lab-overview.json title=Concurrency Lab Overview uid=concurrency-lab-overview panels=39
grafana/dashboards/phase-02-no-lock-baseline.json title=Phase 2 No Lock Baseline uid=phase-02-no-lock-baseline panels=22
```

- [ ] **Step 2: YAML parser dependency를 추가한다**

Run:

```bash
npm install --save-dev yaml
```

Expected:

```text
added 1 package
```

- [ ] **Step 3: `grafana:test` npm script를 추가한다**

Modify `package.json` scripts block so it contains this entry:

```json
{
  "scripts": {
    "grafana:test": "node --test scripts/grafana/lib/*.test.js"
  }
}
```

Keep the existing scripts. The relevant final scripts block should include:

```json
{
  "scripts": {
    "grafana:generate": "node scripts/generate-grafana-dashboards.js",
    "grafana:test": "node --test scripts/grafana/lib/*.test.js",
    "grafana:capture": "node scripts/capture-grafana-dashboard.js",
    "grafana:capture:phase2": "node scripts/capture-grafana-dashboard.js --dashboard phase2 --phase phase-02 --scenario no-lock --preset baseline --pool default --run-window auto",
    "grafana:stitch": "python scripts/stitch-grafana-captures.py",
    "grafana:stitch:phase2": "python scripts/stitch-grafana-captures.py --phase 02-no-lock-baseline",
    "k6:verify-reservation-responses": "node scripts/verify-k6-reservation-responses.js",
    "prometheus:hikari-summary": "node scripts/export-hikari-summary.js"
  }
}
```

- [ ] **Step 4: dependency가 import 가능한지 확인한다**

Run:

```bash
node - <<'NODE'
import { parse } from 'yaml';
const value = parse('name: grafana\n');
console.log(value.name);
NODE
```

Expected:

```text
grafana
```

- [ ] **Step 5: 커밋한다**

```bash
git add package.json package-lock.json
git commit -m "build: add yaml support for grafana generator"
```
