# 001. k6 Summary와 Response Classification 보강

### Task 001: p99 summary와 body 기반 응답 counter 추가

**Files:**
- Modify: `scripts/verify-k6-reservation-responses.js`
- Modify: `k6/reservation-test.js`
- Modify: `k6/presets/phase3-pessimistic-baseline.json`
- Modify: `k6/presets/phase3-optimistic-baseline.json`
- Modify: `k6/presets/phase3-atomic-baseline.json`

- [ ] **Step 1: k6 검증 스크립트를 새 정책 기준으로 먼저 수정한다**

`scripts/verify-k6-reservation-responses.js`의 `checks` 배열을 아래 기준으로 바꾼다.

```javascript
const checks = [
  {
    name: "declares expected statuses from preset",
    passed: source.includes("const expectedStatuses = preset.expectedStatuses || [200, 409];"),
  },
  {
    name: "declares preset-driven response callback",
    passed: source.includes("const reservationResponseCallback = http.expectedStatuses(...expectedStatuses);"),
  },
  {
    name: "uses preset-driven expected status check",
    passed: source.includes('"status is expected": (r) => expectedStatuses.includes(r.status)'),
  },
  {
    name: "declares p99 summary trend stats",
    passed: source.includes('summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"]'),
  },
  {
    name: "declares response classification counters",
    passed:
      source.includes('new Counter("reservation_reserved")') &&
      source.includes('new Counter("reservation_sold_out")') &&
      source.includes('new Counter("reservation_optimistic_lock_exhausted")') &&
      source.includes('new Counter("reservation_unexpected_status")'),
  },
  {
    name: "classifies body status",
    passed:
      source.includes('bodyStatus === "reserved"') &&
      source.includes('bodyStatus === "sold_out"') &&
      source.includes('bodyStatus === "optimistic_lock_exhausted"'),
  },
  {
    name: "does not keep hard-coded 200/409 callback",
    passed: !source.includes("const reservationResponseCallback = http.expectedStatuses(200, 409);"),
  },
];
```

- [ ] **Step 2: 검증 스크립트가 아직 실패하는지 확인한다**

Run:

```bash
rtk npm run k6:verify-reservation-responses
```

Expected:

```text
k6/reservation-test.js: declares expected statuses from preset
k6/reservation-test.js: declares preset-driven response callback
k6/reservation-test.js: declares p99 summary trend stats
```

Exit code는 `1`이어야 한다.

- [ ] **Step 3: `k6/reservation-test.js` import를 확장한다**

기존 import를 아래처럼 바꾼다.

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Gauge } from "k6/metrics";
```

- [ ] **Step 4: expected status를 preset 기반으로 바꾼다**

기존 hard-coded callback:

```javascript
const reservationResponseCallback = http.expectedStatuses(200, 409);
```

을 아래로 교체한다.

```javascript
const expectedStatuses = preset.expectedStatuses || [200, 409];
const reservationResponseCallback = http.expectedStatuses(...expectedStatuses);
```

- [ ] **Step 5: response classification counter를 추가한다**

기존 consistency gauge 선언 아래에 counter를 추가한다.

```javascript
const reservedResponses = new Counter("reservation_reserved");
const soldOutResponses = new Counter("reservation_sold_out");
const optimisticLockExhaustedResponses = new Counter("reservation_optimistic_lock_exhausted");
const unexpectedResponses = new Counter("reservation_unexpected_status");
```

- [ ] **Step 6: k6 summary에 p99를 포함한다**

`export const options` 객체에 `summaryTrendStats`를 추가한다.

```javascript
export const options = {
  tags: {
    phase,
    scenario,
    preset: presetName,
    pool,
  },
  scenarios: {
    [scenario]: buildScenario(),
  },
  thresholds: preset.thresholds || {},
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};
```

- [ ] **Step 7: body 기반 classification 함수를 추가한다**

`teardown()` 아래, `export default function ()` 위에 아래 함수를 추가한다.

```javascript
function responseStatus(res) {
  try {
    return res.json("status");
  } catch (error) {
    console.error(`Failed to parse reservation response JSON: ${error}`);
    return null;
  }
}

function classifyReservationResponse(res) {
  const bodyStatus = responseStatus(res);

  if (res.status === 200 && bodyStatus === "reserved") {
    reservedResponses.add(1);
    return;
  }

  if (res.status === 409 && bodyStatus === "sold_out") {
    soldOutResponses.add(1);
    return;
  }

  if (res.status === 409 && bodyStatus === "optimistic_lock_exhausted") {
    optimisticLockExhaustedResponses.add(1);
    return;
  }

  unexpectedResponses.add(1);
}

function initializeReservationResponseCounters() {
  reservedResponses.add(0);
  soldOutResponses.add(0);
  optimisticLockExhaustedResponses.add(0);
  unexpectedResponses.add(0);
}
```

- [ ] **Step 8: default function의 check와 classification을 바꾼다**

기존 check:

```javascript
check(res, {
  "status 200 or 409": (r) => r.status === 200 || r.status === 409,
});
```

를 아래로 교체한다.

```javascript
check(res, {
  "status is expected": (r) => expectedStatuses.includes(r.status),
});

initializeReservationResponseCounters();
classifyReservationResponse(res);
```

- [ ] **Step 9: Phase 3 preset에 expected status를 추가한다**

`k6/presets/phase3-pessimistic-baseline.json`에 아래 필드를 `path` 다음에 추가한다.

```json
"expectedStatuses": [200, 409]
```

`k6/presets/phase3-optimistic-baseline.json`에 아래 필드를 `path` 다음에 추가한다.

```json
"expectedStatuses": [200, 409]
```

`k6/presets/phase3-atomic-baseline.json`에 아래 필드를 `path` 다음에 추가한다.

```json
"expectedStatuses": [200, 409]
```

- [ ] **Step 10: JSON과 k6 검증을 실행한다**

Run:

```bash
rtk node -e 'const fs=require("fs"); for (const f of fs.readdirSync("k6/presets").filter((name)=>name.endsWith(".json"))) JSON.parse(fs.readFileSync(`k6/presets/${f}`,"utf8")); console.log("json ok")'
rtk npm run k6:verify-reservation-responses
rtk git diff --check
```

Expected:

```text
json ok
```

`npm run k6:verify-reservation-responses`와 `git diff --check`는 exit code `0`.

- [ ] **Step 11: Commit**

Run:

```bash
rtk git add scripts/verify-k6-reservation-responses.js k6/reservation-test.js k6/presets/phase3-pessimistic-baseline.json k6/presets/phase3-optimistic-baseline.json k6/presets/phase3-atomic-baseline.json
rtk git commit -m "feat: classify phase3 reservation responses in k6"
```

Expected:

```text
[... feat: classify phase3 reservation responses in k6]
```
