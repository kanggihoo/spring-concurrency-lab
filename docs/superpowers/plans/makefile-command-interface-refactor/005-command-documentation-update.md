# Makefile Command Interface Refactor Implementation Plan - 005 Command Documentation Update

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 명령 가이드와 프로젝트 표준 문서를 새 Makefile 변수 계약에 맞게 갱신한다.

**Architecture:** 새 문서는 공통 target을 먼저 설명하고, 기존 phase 전용 target은 compatibility target으로 분리한다. 과거 phase runbook 전체를 rewrite하지 않는다.

**Tech Stack:** Markdown, Makefile command examples.

---

## Task 005: Command Documentation Update

**Files:**

- Modify: `docs/guides/commands.md`
- Modify: `docs/guides/project-format-standard.md`

- [ ] **Step 1: `docs/guides/commands.md`의 Common Variables 표를 갱신한다**

Update the table so it includes:

```markdown
| `PRESET` | `baseline` | 기존 호환용 preset 값. `K6_PRESET`, `GRAFANA_PRESET` 기본값으로 사용 |
| `K6_PRESET` | `$(PRESET)` | `k6/presets/<K6_PRESET>.json` 파일명 |
| `GRAFANA_PRESET` | `$(PRESET)` | Grafana `preset` variable과 Prometheus label |
| `PARTS_DIR` | `docs/evidence/<PHASE>/grafana/parts` | Grafana part screenshot output directory |
| `SQL_CONDITION` | `$(CONDITION)` | SQL evidence 조건 이름 |
| `SQL_OUTPUT` | `docs/evidence/<PHASE>/<EXPERIMENT>/<SQL_CONDITION>/sql/consistency.txt` | SQL consistency output file |
```

Keep the existing `PHASE` and `GRAFANA_PHASE` distinction.

- [ ] **Step 2: k6 섹션의 예시를 `K6_PRESET` 중심으로 바꾼다**

Replace examples like:

```bash
make k6-run PRESET=spike MODE=prometheus
```

with:

```bash
make k6-run K6_PRESET=spike MODE=prometheus
```

Add one compatibility note:

```markdown
`PRESET=baseline`은 기존 명령 호환을 위해 유지된다. 새 문서와 새 phase 명령은 `K6_PRESET`을 사용한다.
```

- [ ] **Step 3: Grafana 섹션을 공통 target 중심으로 정리한다**

Add this example near the `grafana-capture` section:

```bash
make grafana-capture \
  PHASE=03-db-strategies/pessimistic-lock \
  GRAFANA_PHASE=phase-03 \
  SCENARIO=pessimistic \
  GRAFANA_PRESET=baseline
```

Add this explanation:

```markdown
`grafana-capture`는 기본적으로 `docs/evidence/<PHASE>/grafana/parts`에 part screenshot을 저장하고, `RUN_WINDOW=auto`일 때 같은 Grafana 디렉터리에서 최신 run-window JSON을 찾는다.
```

- [ ] **Step 4: Phase 3/4 전용 target을 compatibility 섹션으로 이동한다**

Create or update a subsection:

````markdown
## Compatibility Targets

기존 phase 문서 재현성을 위해 아래 target은 유지한다. 신규 phase에서는 이 패턴으로 target을 추가하지 않고 공통 target과 변수 조합을 사용한다.

```bash
make phase3-grafana-capture STRATEGY=pessimistic-lock
make phase3-grafana-stitch STRATEGY=pessimistic-lock
make phase3-sql-consistency STRATEGY=pessimistic-lock
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```
````

- [ ] **Step 5: `docs/guides/project-format-standard.md`의 target 표를 갱신한다**

Update rows:

```markdown
| `k6-run` | k6 preset 실행 | - | `K6_PRESET`, `PRESET`, `MODE`, `TAIL`, `POOL` |
| `k6-evidence` | evidence run id를 명시해 k6 실행 | - | `PHASE`, `K6_PRESET`, `PRESET`, `MODE`, `CONDITION`, `TAIL`, `POOL` |
| `evidence-capture` | k6 실행 후 Grafana 캡처와 stitch 수행 | - | `PHASE`, `K6_PRESET`, `GRAFANA_PHASE`, `SCENARIO`, `GRAFANA_PRESET`, `POOL`, `CONDITION`, `TABLE`, `URI`, `OUTPUT` |
| `grafana-capture` | Grafana dashboard viewport part 캡처 | - | `DASHBOARD`, `PHASE`, `GRAFANA_PHASE`, `SCENARIO`, `GRAFANA_PRESET`, `POOL`, `RUN_WINDOW`, `TABLE`, `URI`, `PARTS_DIR` |
| `sql-consistency` | counted-seat consistency SQL evidence 저장 | `EXPERIMENT` 또는 `SQL_OUTPUT` | `PHASE`, `CONDITION`, `SQL_CONDITION`, `SQL_OUTPUT` |
```

- [ ] **Step 6: 표준 변수 이름 표를 갱신한다**

Ensure the standard variable table includes:

```markdown
| `K6_PRESET` | k6 preset JSON 파일명 | `$(PRESET)` |
| `GRAFANA_PRESET` | Grafana dashboard preset variable | `$(PRESET)` |
| `PARTS_DIR` | Grafana part screenshot output directory | `docs/evidence/<PHASE>/grafana/parts` |
| `SQL_CONDITION` | SQL evidence 조건 이름 | `$(CONDITION)` |
| `SQL_OUTPUT` | SQL consistency output file | `docs/evidence/<PHASE>/<EXPERIMENT>/<SQL_CONDITION>/sql/consistency.txt` |
```

Add this policy sentence:

```markdown
신규 phase에서는 `phase5-*`, `phase6-*` 형식의 Make target을 추가하지 않는다. 공통 target과 명시적 변수 조합으로 실행하고, 이미 공개된 phase 전용 target은 compatibility wrapper로만 유지한다.
```

- [ ] **Step 7: 문서에서 오래된 표현을 점검한다**

Run:

```bash
rtk grep "make k6-run PRESET\\|make k6-evidence .*PRESET\\|phase5-\\|phase6-" docs/guides/commands.md docs/guides/project-format-standard.md
```

Expected:

```text
```

No stale `make k6-run PRESET` examples remain in the guide/standard docs, except when explicitly explaining compatibility.

- [ ] **Step 8: 커밋한다**

Run:

```bash
rtk git add docs/guides/commands.md docs/guides/project-format-standard.md
rtk git commit -m "docs: update make command guide"
```
