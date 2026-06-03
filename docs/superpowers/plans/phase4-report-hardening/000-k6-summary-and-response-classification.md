# 000. k6 Summary와 응답 분류 보강

### Task 000: k6 summary p99와 응답 분류 counter 추가

**Files:**
- Modify: `k6/reservation-test.js`
- Modify: `k6/presets/phase4-atomic-pool.json`
- Modify: `k6/presets/phase4-pessimistic-pool.json`
- Modify: `k6/presets/phase4-pessimistic-timeout.json`
- Modify: `scripts/verify-k6-reservation-responses.js`

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
      source.includes('new Counter("reservation_lock_timeout")') &&
      source.includes('new Counter("reservation_unexpected_status")'),
  },
  {
    name: "does not keep hard-coded 200/409 callback",
    passed: !source.includes("const reservationResponseCallback = http.expectedStatuses(200, 409);"),
  },
];
```

- [ ] **Step 2: 검증 스크립트가 아직 실패하는지 확인한다**

Run:

```powershell
npm run k6:verify-reservation-responses
```

Expected: 실패한다. 최소한 preset 기반 expected status, p99 summary, response counter 관련 메시지가 출력된다.

- [ ] **Step 3: `k6/reservation-test.js` import를 확장한다**

맨 위 import를 아래처럼 바꾼다.

```javascript
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Gauge } from "k6/metrics";
```

현재 파일에 `http` import가 없다면 반드시 추가한다. 이미 있다면 `Counter`만 추가한다.

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

- [ ] **Step 5: 응답 분류 counter를 추가한다**

기존 consistency gauge 선언 아래에 counter를 추가한다.

```javascript
const reservedResponses = new Counter("reservation_reserved");
const soldOutResponses = new Counter("reservation_sold_out");
const lockTimeoutResponses = new Counter("reservation_lock_timeout");
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

- [ ] **Step 7: default function의 check와 classification을 바꾼다**

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

if (res.status === 200) {
  reservedResponses.add(1);
} else if (res.status === 409) {
  soldOutResponses.add(1);
} else if (res.status === 408) {
  lockTimeoutResponses.add(1);
} else {
  unexpectedResponses.add(1);
}
```

- [ ] **Step 8: Phase 4 preset에 expected status를 추가한다**

`k6/presets/phase4-atomic-pool.json`에 아래 필드를 추가한다.

```json
"expectedStatuses": [200, 409]
```

`k6/presets/phase4-pessimistic-pool.json`에 아래 필드를 추가한다.

```json
"expectedStatuses": [200, 409]
```

`k6/presets/phase4-pessimistic-timeout.json`에 아래 필드를 추가한다.

```json
"expectedStatuses": [200, 409, 408]
```

- [ ] **Step 9: JSON과 k6 검증을 실행한다**

Run:

```powershell
node -e "const fs=require('fs'); for (const f of fs.readdirSync('k6/presets').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('k6/presets/'+f,'utf8')); console.log('json ok')"
npm run k6:verify-reservation-responses
git diff --check
```

Expected:

```text
json ok
```

`npm run k6:verify-reservation-responses`와 `git diff --check`는 exit code `0`.

- [ ] **Step 10: Commit**

```powershell
git add k6/reservation-test.js `
        k6/presets/phase4-atomic-pool.json `
        k6/presets/phase4-pessimistic-pool.json `
        k6/presets/phase4-pessimistic-timeout.json `
        scripts/verify-k6-reservation-responses.js
git commit -m "test: harden phase4 k6 response evidence"
```
