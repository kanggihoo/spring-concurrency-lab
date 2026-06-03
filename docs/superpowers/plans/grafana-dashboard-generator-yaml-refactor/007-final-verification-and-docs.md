# Grafana Dashboard Generator YAML Refactor Implementation Plan - 007 Final Verification and Docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YAML 기반 Grafana dashboard workflow를 문서화하고, generator/capture/provisioning 경계가 실제로 깨지지 않았는지 검증한다.

**Architecture:** 구현 변경은 앞 단계에서 끝난다. 이 단계는 사용자-facing command docs와 Grafana guide를 현재 구조에 맞게 갱신하고, 최종 검증 명령을 실행한다.

**Tech Stack:** Markdown, npm scripts, Docker Compose, Grafana provisioning.

---

## Task 007: Final Verification and Docs

**Files:**

- Modify: `docs/guides/commands.md`
- Modify: `docs/guides/grafana-prometheus.md`

- [ ] **Step 1: commands guide의 Grafana generator 설명을 갱신한다**

In `docs/guides/commands.md`, update the Grafana command section so it explains the new source of truth:

````markdown
### Grafana dashboard 생성

Grafana dashboard JSON은 직접 편집하지 않는다. 다음 YAML 파일이 source of truth다.

```text
scripts/grafana/dashboards/overview.yml
scripts/grafana/rows/*.yml
scripts/grafana/queries/*.yml
```

생성 명령:

```bash
make grafana-generate
```

생성 결과:

```text
grafana/dashboards/concurrency-lab-overview.json
```

Phase별 metric 추가는 `queries/*.yml`에 PromQL alias를 추가하고, `rows/*.yml`에 panel을 추가한 뒤 `overview.yml`의 `rows` 목록에 row id를 추가한다.
````

- [ ] **Step 2: Grafana guide에 YAML workflow를 추가한다**

Append this section to `docs/guides/grafana-prometheus.md`:

````markdown
## Dashboard YAML Workflow

Grafana dashboard의 편집 기준은 generated JSON이 아니라 YAML spec이다.

```text
scripts/grafana/dashboards/overview.yml
scripts/grafana/rows/*.yml
scripts/grafana/queries/*.yml
```

역할:

- `dashboards/overview.yml`: dashboard metadata, variables, row 순서
- `rows/*.yml`: row title과 panel 목록
- `queries/*.yml`: PromQL alias와 expression

연결 규칙:

```text
rows/*.yml 의 panel.query 값 == queries/*.yml 의 key
```

Grafana capture는 별도 YAML을 사용하지 않는다. `scripts/capture-grafana-dashboard.js`는 `overview` dashboard 전체를 Playwright로 스크롤 캡처하고, phase/scenario/preset/pool은 URL variable로 전달한다.
````

- [ ] **Step 3: generator unit test를 실행한다**

Run:

```bash
npm run grafana:test
```

Expected:

```text
# fail 0
```

- [ ] **Step 4: dashboard JSON을 재생성한다**

Run:

```bash
npm run grafana:generate
```

Expected:

```text
Generated grafana/dashboards/concurrency-lab-overview.json
```

- [ ] **Step 5: generated JSON contract를 검증한다**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs');
const expectedVariables = ['phase', 'scenario', 'preset', 'pool', 'uri', 'table'];
const dashboard = JSON.parse(fs.readFileSync('grafana/dashboards/concurrency-lab-overview.json', 'utf8'));
const variables = dashboard.templating.list.map((variable) => variable.name);
const missingVariables = expectedVariables.filter((name) => !variables.includes(name));
const titles = dashboard.panels.map((panel) => panel.title);

if (dashboard.uid !== 'concurrency-lab-overview') {
  throw new Error(`Unexpected uid: ${dashboard.uid}`);
}
if (missingVariables.length > 0) {
  throw new Error(`Missing variables: ${missingVariables.join(', ')}`);
}
for (const title of ['Run Summary', 'k6 Load', 'Spring API', 'Hikari Pool', 'PostgreSQL Activity', 'Table Access', 'Reservation Consistency']) {
  if (!titles.includes(title)) {
    throw new Error(`Missing panel row: ${title}`);
  }
}
console.log(`uid=${dashboard.uid}`);
console.log(`variables=${variables.join(',')}`);
console.log(`panels=${dashboard.panels.length}`);
NODE
```

Expected:

```text
uid=concurrency-lab-overview
variables=phase,scenario,preset,pool,uri,table
panels=44
```

- [ ] **Step 6: capture help와 phase2 alias를 검증한다**

Run:

```bash
npm run grafana:capture -- --help
node - <<'NODE'
import { readFile } from 'node:fs/promises';
const source = await readFile('scripts/capture-grafana-dashboard.js', 'utf8');
for (const fragment of [
  "dashboard: 'overview'",
  "aliasFor: 'overview'",
  'dashboardResolved:',
  "const url = new URL(`/d/${dashboard.uid}/${dashboard.slug}`",
]) {
  if (!source.includes(fragment)) {
    throw new Error(`Missing capture source fragment: ${fragment}`);
  }
}
console.log('capture overview compatibility source check passed');
NODE
```

Expected:

```text
Usage: node scripts/capture-grafana-dashboard.js [options]
capture overview compatibility source check passed
```

- [ ] **Step 7: Grafana provisioning smoke test를 실행한다**

Run:

```bash
docker compose up -d prometheus grafana
docker compose ps grafana
```

Expected:

```text
grafana   grafana/grafana:latest   ...   Up
```

Then open:

```text
http://localhost:3000/d/concurrency-lab-overview/concurrency-lab-overview
```

Expected: Grafana loads the `Concurrency Lab Overview` dashboard without JSON import errors.

- [ ] **Step 8: repository hygiene를 확인한다**

Run:

```bash
git diff --check
git status --short
```

Expected:

```text
No output from git diff --check
```

`git status --short` should only show files intentionally changed by this Grafana refactor. Existing unrelated untracked files must not be staged.

- [ ] **Step 9: 커밋한다**

```bash
git add docs/guides/commands.md docs/guides/grafana-prometheus.md
git commit -m "docs: document grafana yaml dashboard workflow"
```
