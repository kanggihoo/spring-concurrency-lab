# k6 JS Module Separation Implementation Plan - 002 Metrics and Response Classifier

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** custom metric 선언과 HTTP 응답 classification을 `metrics.js`, `response-classifier.js`로 분리한다.

**Architecture:** `metrics.js`는 metric 인스턴스 생성과 초기 seed만 담당한다. `response-classifier.js`는 expected status callback, status code classification, classification별 counter 증가를 담당한다.

**Tech Stack:** k6 `Counter`, k6 `Gauge`, k6 `http.expectedStatuses`.

---

## Task 002: Metrics and Response Classifier

**Files:**

- Create: `k6/lib/metrics.js`
- Create: `k6/lib/response-classifier.js`

- [ ] **Step 1: `metrics.js`를 추가한다**

Create `k6/lib/metrics.js`:

```js
import { Counter, Gauge } from "k6/metrics";

export function createReservationMetrics() {
  return {
    reservedResponses: new Counter("reservation_reserved"),
    soldOutResponses: new Counter("reservation_sold_out"),
    lockTimeoutResponses: new Counter("reservation_lock_timeout"),
    unexpectedResponses: new Counter("reservation_unexpected_status"),
    reservationCount: new Gauge("concert_reservation_count"),
    remainingSeats: new Gauge("concert_remaining_seats"),
    seatCountInconsistency: new Gauge("concert_seat_count_inconsistency"),
    overbooked: new Gauge("concert_overbooked"),
  };
}

export function initializeMetrics(metrics) {
  metrics.reservedResponses.add(0);
  metrics.soldOutResponses.add(0);
  metrics.lockTimeoutResponses.add(0);
  metrics.unexpectedResponses.add(0);
}
```

- [ ] **Step 2: `response-classifier.js`를 추가한다**

Create `k6/lib/response-classifier.js`:

```js
import http from "k6/http";

const RESERVED = "reserved";
const SOLD_OUT = "soldOut";
const LOCK_TIMEOUT = "lockTimeout";
const UNEXPECTED = "unexpected";

export function createExpectedStatusCallback(expectedStatuses) {
  return http.expectedStatuses(...expectedStatuses);
}

export function classifyReservationResponse(response) {
  if (response.status === 200) {
    return RESERVED;
  }

  if (response.status === 409) {
    return SOLD_OUT;
  }

  if (response.status === 408) {
    return LOCK_TIMEOUT;
  }

  return UNEXPECTED;
}

export function recordReservationClassification(metrics, classification) {
  if (classification === RESERVED) {
    metrics.reservedResponses.add(1);
    return;
  }

  if (classification === SOLD_OUT) {
    metrics.soldOutResponses.add(1);
    return;
  }

  if (classification === LOCK_TIMEOUT) {
    metrics.lockTimeoutResponses.add(1);
    return;
  }

  metrics.unexpectedResponses.add(1);
}
```

- [ ] **Step 3: 정적 검증이 남은 모듈 때문에 계속 실패하는지 확인한다**

Run:

```bash
npm run k6:verify-reservation-responses
```

Expected output still includes:

```text
missing file: k6/lib/consistency.js
missing file: k6/lib/reservation-scenario.js
```

The command exits with status `1`.

- [ ] **Step 4: 커밋한다**

```bash
git add k6/lib/metrics.js k6/lib/response-classifier.js
git commit -m "refactor: extract k6 metrics and response classifier"
```
