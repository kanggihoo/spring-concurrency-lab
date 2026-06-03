# k6 JS Module Separation Implementation Plan - 000 Baseline and Static Guard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현재 k6 검증 기준선을 확인하고, 모듈 분리가 완료될 때까지 실패하는 정적 검증 guard를 먼저 만든다.

**Architecture:** 실제 k6 모듈을 만들기 전에 `scripts/verify-k6-reservation-responses.js`를 구조 검증 스크립트로 강화한다. 이 단계의 새 검증은 아직 `k6/lib/*.js`가 없기 때문에 실패해야 한다.

**Tech Stack:** Node.js ESM, `node:fs`, npm script `k6:verify-reservation-responses`.

---

## Task 000: Baseline and Static Guard

**Files:**

- Modify: `scripts/verify-k6-reservation-responses.js`

- [ ] **Step 1: 현재 검증 기준선을 확인한다**

Run:

```bash
npm run k6:verify-reservation-responses
```

Expected:

```text
> spring-concurrency-lab-tools@0.0.0 k6:verify-reservation-responses
> node scripts/verify-k6-reservation-responses.js
```

The command exits with status `0`.

- [ ] **Step 2: 정적 검증 스크립트를 모듈 분리 기준에 맞게 교체한다**

Replace `scripts/verify-k6-reservation-responses.js` with:

```js
import { existsSync, readFileSync } from "node:fs";

const files = {
  entrypoint: "k6/reservation-test.js",
  config: "k6/lib/config.js",
  scenarios: "k6/lib/scenarios.js",
  metrics: "k6/lib/metrics.js",
  classifier: "k6/lib/response-classifier.js",
  consistency: "k6/lib/consistency.js",
  reservationScenario: "k6/lib/reservation-scenario.js",
};

let failures = 0;

function fail(message) {
  console.error(message);
  failures += 1;
}

function readSource(path) {
  if (!existsSync(path)) {
    fail(`missing file: ${path}`);
    return "";
  }

  return readFileSync(path, "utf8");
}

function assertIncludes(path, source, snippets) {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      fail(`${path}: missing snippet: ${snippet}`);
    }
  }
}

function assertNotIncludes(path, source, snippets) {
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      fail(`${path}: forbidden snippet: ${snippet}`);
    }
  }
}

const sources = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readSource(path)]),
);

assertIncludes(files.entrypoint, sources.entrypoint, [
  'import { loadConfig } from "./lib/config.js";',
  'import { captureConsistency, resetIfNeeded } from "./lib/consistency.js";',
  'import { createReservationMetrics, initializeMetrics } from "./lib/metrics.js";',
  'import { runReservationScenario } from "./lib/reservation-scenario.js";',
  'import { createExpectedStatusCallback } from "./lib/response-classifier.js";',
  'import { buildOptions } from "./lib/scenarios.js";',
  "export const options = buildOptions(config);",
  "export function setup()",
  "export function teardown()",
  "export default function ()",
]);

assertNotIncludes(files.entrypoint, sources.entrypoint, [
  'new Counter("reservation_reserved")',
  'new Gauge("concert_reservation_count")',
  "http.post(",
  "http.get(",
  "http.expectedStatuses(200, 409)",
]);

const entrypointLines = sources.entrypoint
  .split(/\r?\n/)
  .filter((line) => line.trim().length > 0);

if (entrypointLines.length > 45) {
  fail(`${files.entrypoint}: expected at most 45 non-empty lines, got ${entrypointLines.length}`);
}

assertIncludes(files.config, sources.config, [
  "export function loadConfig(env = __ENV)",
  'const presetPath = env.PRESET || "presets/baseline.json";',
  'const baseUrl = env.BASE_URL || preset.baseUrl || "http://host.docker.internal:8080";',
  "expectedStatuses: normalizeExpectedStatuses(preset, presetPath)",
  "tags: {",
  "phase,",
  "scenario,",
  "preset: presetName,",
  "pool,",
]);

assertIncludes(files.scenarios, sources.scenarios, [
  "export function buildOptions(config)",
  'executor === "constant-vus"',
  'executor === "ramping-vus"',
  'summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"]',
]);

assertIncludes(files.metrics, sources.metrics, [
  'new Counter("reservation_reserved")',
  'new Counter("reservation_sold_out")',
  'new Counter("reservation_lock_timeout")',
  'new Counter("reservation_unexpected_status")',
  'new Gauge("concert_reservation_count")',
  'new Gauge("concert_remaining_seats")',
  'new Gauge("concert_seat_count_inconsistency")',
  'new Gauge("concert_overbooked")',
  "export function createReservationMetrics()",
  "export function initializeMetrics(metrics)",
]);

assertIncludes(files.classifier, sources.classifier, [
  "export function createExpectedStatusCallback(expectedStatuses)",
  "return http.expectedStatuses(...expectedStatuses);",
  "export function classifyReservationResponse(response)",
  "export function recordReservationClassification(metrics, classification)",
]);

assertNotIncludes(files.classifier, sources.classifier, [
  "http.expectedStatuses(200, 409)",
]);

assertIncludes(files.consistency, sources.consistency, [
  "export function resetIfNeeded(config)",
  "export function captureConsistency(config, metrics)",
  'http.post(`${config.baseUrl}/api/test/reset`)',
  'http.get(`${config.baseUrl}/api/test/consistency`)',
  "reservationCount",
  "remainingSeats",
  "seatCountInconsistency",
  "overbooked",
]);

assertIncludes(files.reservationScenario, sources.reservationScenario, [
  "export function runReservationScenario(config, metrics, responseCallback)",
  '`${config.baseUrl}${config.reservationPath}`',
  '"Content-Type": "application/json"',
  '"status is expected": (r) => config.expectedStatuses.includes(r.status)',
  "recordReservationClassification(metrics, classification)",
]);

if (failures > 0) {
  process.exitCode = 1;
}
```

- [ ] **Step 3: 새 guard가 현재 코드에서 실패하는지 확인한다**

Run:

```bash
npm run k6:verify-reservation-responses
```

Expected output includes:

```text
missing file: k6/lib/config.js
missing file: k6/lib/scenarios.js
missing file: k6/lib/metrics.js
missing file: k6/lib/response-classifier.js
missing file: k6/lib/consistency.js
missing file: k6/lib/reservation-scenario.js
```

The command exits with status `1`.

- [ ] **Step 4: 커밋한다**

```bash
git add scripts/verify-k6-reservation-responses.js
git commit -m "test: add k6 module separation guard"
```
