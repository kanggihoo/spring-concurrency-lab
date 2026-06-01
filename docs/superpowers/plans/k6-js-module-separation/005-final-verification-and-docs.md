# k6 JS Module Separation Implementation Plan - 005 Final Verification and Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 preset이 새 모듈 구조에서 k6 runtime 초기화를 통과하는지 확인하고, k6 guide에 코드 구조를 문서화한다.

**Architecture:** 실제 애플리케이션 서버가 없어도 `grafana/k6 inspect`로 k6 init context와 `options` 생성을 검증한다. 문서는 실행 방식이 아니라 코드 책임 분리만 추가 설명한다.

**Tech Stack:** Docker, `grafana/k6`, npm script, Makefile, Markdown.

---

## Task 005: Final Verification and Docs

**Files:**

- Modify: `docs/guides/k6-load-testing.md`

- [ ] **Step 1: 모든 preset이 k6 inspect를 통과하는지 확인한다**

Run:

```bash
for preset in k6/presets/*.json; do
  name="$(basename "$preset")"
  echo "inspect $name"
  docker run --rm -i \
    -v "$PWD/k6:/k6" \
    -w /k6 \
    grafana/k6 \
    inspect \
    -e PRESET="/k6/presets/$name" \
    /k6/reservation-test.js >/tmp/k6-inspect-"$name"
done
```

Expected output:

```text
inspect baseline.json
inspect phase3-atomic-baseline.json
inspect phase3-optimistic-baseline.json
inspect phase3-pessimistic-baseline.json
inspect phase4-atomic-pool.json
inspect phase4-pessimistic-pool.json
inspect phase4-pessimistic-timeout.json
inspect ramp-up.json
inspect spike.json
inspect sustained.json
```

The command exits with status `0`.

- [ ] **Step 2: baseline inspect 결과가 기존 label/scenario 계약을 유지하는지 확인한다**

Run:

```bash
docker run --rm -i \
  -v "$PWD/k6:/k6" \
  -w /k6 \
  grafana/k6 \
  inspect \
  -e PRESET="/k6/presets/baseline.json" \
  /k6/reservation-test.js >/tmp/k6-baseline-inspect.json

node - <<'NODE'
const fs = require('node:fs');
const inspect = JSON.parse(fs.readFileSync('/tmp/k6-baseline-inspect.json', 'utf8'));
const options = inspect.options || inspect;
console.log(`scenario=${Object.keys(options.scenarios).join(',')}`);
console.log(`phase=${options.tags.phase}`);
console.log(`preset=${options.tags.preset}`);
console.log(`pool=${options.tags.pool}`);
console.log(`p99=${options.summaryTrendStats.includes('p(99)')}`);
NODE
```

Expected:

```text
scenario=no-lock
phase=phase-02
preset=baseline
pool=default
p99=true
```

- [ ] **Step 3: k6 guide에 모듈 구조를 추가한다**

Modify `docs/guides/k6-load-testing.md` by adding this section after the "Current Entry Point" section:

```markdown
## Script Layout

`k6/reservation-test.js`는 k6 lifecycle entrypoint이다. 실제 책임은 `k6/lib/` 아래 모듈로 나뉜다.

| File | Responsibility |
|---|---|
| `k6/lib/config.js` | preset JSON과 환경변수를 읽어 실행 config를 만든다. |
| `k6/lib/scenarios.js` | k6 executor와 `options.scenarios`를 만든다. |
| `k6/lib/metrics.js` | Reservation custom Counter/Gauge metric을 선언한다. |
| `k6/lib/response-classifier.js` | HTTP 응답을 reserved, sold out, timeout, unexpected로 분류한다. |
| `k6/lib/consistency.js` | setup reset과 teardown consistency snapshot metric을 처리한다. |
| `k6/lib/reservation-scenario.js` | VU 1회 Reservation HTTP 요청을 실행한다. |
```

- [ ] **Step 4: 최종 검증 명령을 실행한다**

Run:

```bash
npm run k6:verify-reservation-responses
make k6-verify
git diff --check
```

Expected:

```text
> spring-concurrency-lab-tools@0.0.0 k6:verify-reservation-responses
> node scripts/verify-k6-reservation-responses.js
npm run k6:verify-reservation-responses
```

`git diff --check` exits with status `0`.

- [ ] **Step 5: 커밋한다**

```bash
git add docs/guides/k6-load-testing.md
git commit -m "docs: document k6 module layout"
```

- [ ] **Step 6: 최종 상태를 확인한다**

Run:

```bash
git status --short
git log --oneline -6
```

`git status --short` prints no changed files. The latest commits include:

```text
docs: document k6 module layout
refactor: slim k6 reservation entrypoint
refactor: extract k6 consistency handling
refactor: extract k6 metrics and response classifier
refactor: extract k6 config and scenarios
test: add k6 module separation guard
```
