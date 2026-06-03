# k6 JS Module Separation Implementation Plan - 001 Config and Scenarios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** preset/env 로딩과 k6 `options` 생성을 `config.js`, `scenarios.js`로 분리한다.

**Architecture:** `config.js`는 k6 global `open()`과 `__ENV`를 사용해 정규화된 config 객체를 만든다. `scenarios.js`는 정규화된 config를 입력으로 받아 기존 `options` 구조를 생성한다.

**Tech Stack:** k6 JavaScript runtime, k6 ES modules.

---

## Task 001: Config and Scenarios

**Files:**

- Create: `k6/lib/config.js`
- Create: `k6/lib/scenarios.js`

- [ ] **Step 1: `config.js`를 추가한다**

Create `k6/lib/config.js`:

```js
const DEFAULT_PRESET_PATH = "presets/baseline.json";
const DEFAULT_BASE_URL = "http://host.docker.internal:8080";
const DEFAULT_RESERVATION_PATH = "/api/reservations";
const DEFAULT_EXPECTED_STATUSES = [200, 409];

function requiredString(preset, presetPath, name) {
  const value = preset[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Preset ${presetPath} must define non-empty string field: ${name}`);
  }
  return value;
}

function normalizeExpectedStatuses(preset, presetPath) {
  const expectedStatuses = preset.expectedStatuses || DEFAULT_EXPECTED_STATUSES;
  const validStatuses =
    Array.isArray(expectedStatuses) &&
    expectedStatuses.length > 0 &&
    expectedStatuses.every((status) => Number.isInteger(status) && status >= 100 && status <= 599);

  if (!validStatuses) {
    throw new Error(`Preset ${presetPath} must define expectedStatuses as HTTP status integers`);
  }

  return expectedStatuses;
}

function normalizeSleepSeconds(preset, presetPath) {
  const sleepSeconds = preset.sleepSeconds || 0;
  if (!Number.isFinite(sleepSeconds) || sleepSeconds < 0) {
    throw new Error(`Preset ${presetPath} must define sleepSeconds as a non-negative number`);
  }
  return sleepSeconds;
}

export function loadConfig(env = __ENV) {
  const presetPath = env.PRESET || DEFAULT_PRESET_PATH;
  const preset = JSON.parse(open(presetPath));
  const phase = requiredString(preset, presetPath, "phase");
  const scenario = requiredString(preset, presetPath, "scenario");
  const presetName = requiredString(preset, presetPath, "preset");
  const pool = env.POOL || requiredString(preset, presetPath, "pool");
  const baseUrl = env.BASE_URL || preset.baseUrl || DEFAULT_BASE_URL;

  return {
    presetPath,
    preset,
    baseUrl,
    reservationPath: preset.path || DEFAULT_RESERVATION_PATH,
    expectedStatuses: normalizeExpectedStatuses(preset, presetPath),
    phase,
    scenario,
    presetName,
    pool,
    tags: {
      phase,
      scenario,
      preset: presetName,
      pool,
    },
    resetBeforeRun: preset.resetBeforeRun !== false,
    captureConsistency: preset.captureConsistency !== false,
    sleepSeconds: normalizeSleepSeconds(preset, presetPath),
    concertId: preset.concertId || 1,
  };
}
```

- [ ] **Step 2: `scenarios.js`를 추가한다**

Create `k6/lib/scenarios.js`:

```js
function requiredExecutor(config) {
  const executor = config.preset.executor;
  if (typeof executor !== "string" || executor.length === 0) {
    throw new Error(`Preset ${config.presetPath} must define non-empty string field: executor`);
  }
  return executor;
}

function buildScenario(config) {
  const executor = requiredExecutor(config);

  if (executor === "constant-vus") {
    return {
      executor,
      vus: config.preset.vus,
      duration: config.preset.duration,
    };
  }

  if (executor === "ramping-vus") {
    return {
      executor,
      startVUs: config.preset.startVUs || 0,
      stages: config.preset.stages,
    };
  }

  throw new Error(`Unsupported executor in ${config.presetPath}: ${executor}`);
}

export function buildOptions(config) {
  return {
    tags: config.tags,
    scenarios: {
      [config.scenario]: buildScenario(config),
    },
    thresholds: config.preset.thresholds || {},
    summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  };
}
```

- [ ] **Step 3: 정적 검증이 남은 모듈 때문에 계속 실패하는지 확인한다**

Run:

```bash
npm run k6:verify-reservation-responses
```

Expected output still includes:

```text
missing file: k6/lib/metrics.js
missing file: k6/lib/response-classifier.js
missing file: k6/lib/consistency.js
missing file: k6/lib/reservation-scenario.js
```

The command exits with status `1`.

- [ ] **Step 4: 커밋한다**

```bash
git add k6/lib/config.js k6/lib/scenarios.js
git commit -m "refactor: extract k6 config and scenarios"
```
