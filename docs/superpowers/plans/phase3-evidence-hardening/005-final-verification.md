# 005. 최종 검증

### Task 005: Phase 3 hardening 완료 기준 검증

**Files:**
- Read: `docs/phases/03-db-strategies/report.md`
- Read: `docs/phases/03-db-strategies/README.md`
- Read: `docs/phases/03-db-strategies/scope.md`
- Read: `docs/evidence/03-db-strategies/**`
- Read: `k6/reservation-test.js`
- Read: `scripts/verify-k6-reservation-responses.js`

- [ ] **Step 1: k6 정책 검증을 실행한다**

Run:

```bash
rtk npm run k6:verify-reservation-responses
```

Expected:

```text
exit code 0
```

- [ ] **Step 2: Java 전체 테스트를 실행한다**

Run:

```bash
rtk sh -lc 'cd concurrency && ./gradlew test'
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 3: 새 evidence 파일 존재를 검증한다**

Run:

```bash
rtk node - <<'NODE'
const fs = require("fs");

const requiredByStrategy = {
  "pessimistic-lock": [
    "k6",
    "logs",
    "sql/baseline-consistency.txt",
    "sql/pg-stat-activity.txt",
    "sql/pg-lock-summary.txt",
    "prometheus/k6-window-summary.json",
    "prometheus/pg-locks-count.json",
    "grafana/stitched-dashboard.png",
  ],
  "optimistic-lock": [
    "k6",
    "logs",
    "sql/baseline-consistency.txt",
    "prometheus/k6-window-summary.json",
    "prometheus/optimistic-retry-total.json",
    "grafana/stitched-dashboard.png",
  ],
  "atomic-update": [
    "k6",
    "logs",
    "sql/baseline-consistency.txt",
    "prometheus/k6-window-summary.json",
    "grafana/stitched-dashboard.png",
  ],
};

for (const [strategy, paths] of Object.entries(requiredByStrategy)) {
  for (const relativePath of paths) {
    const path = `docs/evidence/03-db-strategies/${strategy}/${relativePath}`;
    if (!fs.existsSync(path)) throw new Error(`missing ${path}`);
  }

  const k6Dir = `docs/evidence/03-db-strategies/${strategy}/k6`;
  const logDir = `docs/evidence/03-db-strategies/${strategy}/logs`;
  if (!fs.readdirSync(k6Dir).some((name) => name.endsWith("-summary.json"))) {
    throw new Error(`missing k6 summary in ${k6Dir}`);
  }
  if (!fs.readdirSync(logDir).some((name) => name.endsWith(".log"))) {
    throw new Error(`missing log in ${logDir}`);
  }

  console.log(`${strategy} evidence ok`);
}
NODE
```

Expected:

```text
pessimistic-lock evidence ok
optimistic-lock evidence ok
atomic-update evidence ok
```

- [ ] **Step 4: report가 archive evidence를 참조하지 않는지 검증한다**

Run:

```bash
rtk rg "archive/20260527-original|20260527-091" docs/phases/03-db-strategies/report.md
```

Expected:

```text
no matches
```

- [ ] **Step 5: unexpected response가 report에 반영되었는지 검증한다**

Run:

```bash
rtk node - <<'NODE'
const fs = require("fs");
const report = fs.readFileSync("docs/phases/03-db-strategies/report.md", "utf8");
const strategies = ["pessimistic-lock", "optimistic-lock", "atomic-update"];
for (const strategy of strategies) {
  const dir = `docs/evidence/03-db-strategies/${strategy}/k6`;
  const file = fs.readdirSync(dir).filter((name) => name.endsWith("-summary.json")).sort().at(-1);
  const summary = JSON.parse(fs.readFileSync(`${dir}/${file}`, "utf8"));
  const unexpected = summary.metrics.reservation_unexpected_status?.values?.count ?? 0;
  if (unexpected > 0 && !report.includes("Unexpected")) {
    throw new Error(`${strategy} has unexpected=${unexpected}, but report does not mention Unexpected`);
  }
  console.log(`${strategy} unexpected=${unexpected}`);
}
NODE
```

Expected:

```text
pessimistic-lock unexpected=0
optimistic-lock unexpected=0
atomic-update unexpected=0
```

값이 0이 아니면 report의 `Findings` 또는 `Limitations`에 해당 값을 설명해야 한다.

- [ ] **Step 6: formatting과 diff 검증을 실행한다**

Run:

```bash
rtk git diff --check
rtk git status --short
```

Expected:

```text
git diff --check exit code 0
```

`git status --short`에는 의도한 파일만 보여야 한다.

- [ ] **Step 7: 최종 commit**

Run:

```bash
rtk git add docs/phases/03-db-strategies docs/evidence/03-db-strategies k6 scripts package.json concurrency/src/test/java/com/example/concurrency/controller/ReservationControllerTest.java
rtk git commit -m "docs: verify phase3 evidence hardening"
```

Expected:

```text
[... docs: verify phase3 evidence hardening]
```

이미 모든 변경이 앞선 task에서 commit되었다면 이 step은 아래 출력으로 끝난다.

```text
nothing to commit, working tree clean
```
