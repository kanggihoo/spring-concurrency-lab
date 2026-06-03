# k6 JS Module Separation Implementation Plan - 003 Consistency Module

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** setup reset과 teardown consistency snapshot 처리를 `consistency.js`로 분리한다.

**Architecture:** `consistency.js`는 `/api/test/reset`과 `/api/test/consistency`만 알고, Reservation 요청 실행 방식은 모른다. snapshot validation은 기존 로직과 같은 필드 계약을 유지한다.

**Tech Stack:** k6 `http`, k6 `check`.

---

## Task 003: Consistency Module

**Files:**

- Create: `k6/lib/consistency.js`

- [ ] **Step 1: `consistency.js`를 추가한다**

Create `k6/lib/consistency.js`:

```js
import { check } from "k6";
import http from "k6/http";

function parseConsistencySnapshot(response) {
  let snapshot;
  try {
    snapshot = response.json();
  } catch (error) {
    console.error(`Failed to parse consistency snapshot JSON: ${error}`);
    return null;
  }

  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    console.error("Consistency snapshot JSON is not an object");
    return null;
  }

  const numericFields = [
    "reservationCount",
    "remainingSeats",
    "seatCountInconsistency",
  ];
  const missingNumericFields = numericFields.filter(
    (field) => !Number.isFinite(snapshot[field]),
  );

  if (missingNumericFields.length > 0) {
    console.error(
      `Consistency snapshot has missing or non-numeric fields: ${missingNumericFields.join(", ")}`,
    );
    return null;
  }

  if (typeof snapshot.overbooked !== "boolean") {
    console.error("Consistency snapshot has missing or non-boolean field: overbooked");
    return null;
  }

  return snapshot;
}

function recordConsistencySnapshot(metrics, snapshot) {
  metrics.reservationCount.add(snapshot.reservationCount);
  metrics.remainingSeats.add(snapshot.remainingSeats);
  metrics.seatCountInconsistency.add(snapshot.seatCountInconsistency);
  metrics.overbooked.add(snapshot.overbooked ? 1 : 0);
}

export function resetIfNeeded(config) {
  if (!config.resetBeforeRun) {
    return;
  }

  const res = http.post(`${config.baseUrl}/api/test/reset`);
  check(res, {
    "reset OK": (r) => r.status === 200,
  });
}

export function captureConsistency(config, metrics) {
  if (!config.captureConsistency) {
    return;
  }

  const res = http.get(`${config.baseUrl}/api/test/consistency`);
  check(res, {
    "consistency snapshot OK": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    return;
  }

  const snapshot = parseConsistencySnapshot(res);
  if (snapshot === null) {
    return;
  }

  recordConsistencySnapshot(metrics, snapshot);
}
```

- [ ] **Step 2: 정적 검증이 reservation scenario와 entrypoint 때문에 계속 실패하는지 확인한다**

Run:

```bash
npm run k6:verify-reservation-responses
```

Expected output still includes:

```text
missing file: k6/lib/reservation-scenario.js
k6/reservation-test.js: missing snippet: import { loadConfig } from "./lib/config.js";
```

The command exits with status `1`.

- [ ] **Step 3: 커밋한다**

```bash
git add k6/lib/consistency.js
git commit -m "refactor: extract k6 consistency handling"
```
