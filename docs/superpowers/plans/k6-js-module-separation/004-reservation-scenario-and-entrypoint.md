# k6 JS Module Separation Implementation Plan - 004 Reservation Scenario and Entrypoint

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VU 1회 Reservation 요청 로직을 `reservation-scenario.js`로 옮기고, `reservation-test.js`를 orchestration entrypoint로 축소한다.

**Architecture:** `reservation-scenario.js`는 HTTP POST, payload 생성, expected status check, response classification 기록, sleep을 담당한다. `reservation-test.js`는 config, metrics, options, setup, teardown, default lifecycle 연결만 담당한다.

**Tech Stack:** k6 `http`, k6 `check`, k6 `sleep`, k6 ES modules.

---

## Task 004: Reservation Scenario and Entrypoint

**Files:**

- Create: `k6/lib/reservation-scenario.js`
- Modify: `k6/reservation-test.js`

- [ ] **Step 1: `reservation-scenario.js`를 추가한다**

Create `k6/lib/reservation-scenario.js`:

```js
import { check, sleep } from "k6";
import http from "k6/http";
import {
  classifyReservationResponse,
  recordReservationClassification,
} from "./response-classifier.js";

function buildReservationRequestBody(config) {
  return JSON.stringify({
    concertId: config.concertId,
    userId: __VU,
  });
}

export function runReservationScenario(config, metrics, responseCallback) {
  const res = http.post(
    `${config.baseUrl}${config.reservationPath}`,
    buildReservationRequestBody(config),
    {
      headers: { "Content-Type": "application/json" },
      responseCallback,
    },
  );

  check(res, {
    "status is expected": (r) => config.expectedStatuses.includes(r.status),
  });

  const classification = classifyReservationResponse(res);
  recordReservationClassification(metrics, classification);

  if (config.sleepSeconds > 0) {
    sleep(config.sleepSeconds);
  }
}
```

- [ ] **Step 2: `reservation-test.js`를 orchestration 코드로 교체한다**

Replace `k6/reservation-test.js` with:

```js
import { loadConfig } from "./lib/config.js";
import { captureConsistency, resetIfNeeded } from "./lib/consistency.js";
import { createReservationMetrics, initializeMetrics } from "./lib/metrics.js";
import { runReservationScenario } from "./lib/reservation-scenario.js";
import { createExpectedStatusCallback } from "./lib/response-classifier.js";
import { buildOptions } from "./lib/scenarios.js";

const config = loadConfig();
const metrics = createReservationMetrics();
const reservationResponseCallback = createExpectedStatusCallback(config.expectedStatuses);

export const options = buildOptions(config);

export function setup() {
  initializeMetrics(metrics);
  resetIfNeeded(config);
}

export function teardown() {
  captureConsistency(config, metrics);
}

export default function () {
  runReservationScenario(config, metrics, reservationResponseCallback);
}
```

- [ ] **Step 3: 정적 검증이 통과하는지 확인한다**

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

- [ ] **Step 4: Makefile wrapper 검증도 통과하는지 확인한다**

Run:

```bash
make k6-verify
```

Expected:

```text
npm run k6:verify-reservation-responses
```

The command exits with status `0`.

- [ ] **Step 5: 커밋한다**

```bash
git add k6/lib/reservation-scenario.js k6/reservation-test.js
git commit -m "refactor: slim k6 reservation entrypoint"
```
