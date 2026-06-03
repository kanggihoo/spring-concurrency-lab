# Makefile Command Interface Refactor Implementation Plan - 006 Final Verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Makefile 리팩토링이 기존 명령 호환성과 새 공통 변수 계약을 모두 만족하는지 최종 검증한다.

**Architecture:** 실제 서비스 실행이 필요한 명령은 dry-run으로 검증하고, 저비용 검증 명령은 실제 실행한다. Grafana/k6 script 자체는 변경하지 않았으므로 기존 npm 검증을 재사용한다.

**Tech Stack:** GNU Make dry-run, npm scripts, Docker Compose CLI, git.

---

## Task 006: Final Verification

**Files:**

- Verify: `Makefile`
- Verify: `makefiles/*.mk`
- Verify: `docs/guides/commands.md`
- Verify: `docs/guides/project-format-standard.md`

- [ ] **Step 1: Makefile include 구조를 확인한다**

Run:

```bash
rtk sed -n '1,80p' Makefile
rtk find makefiles -maxdepth 1 -type f | sort
```

Expected:

```text
include makefiles/config.mk
include makefiles/help.mk
include makefiles/env.mk
include makefiles/app.mk
include makefiles/k6.mk
include makefiles/grafana.mk
include makefiles/evidence.mk
include makefiles/sql.mk
include makefiles/phase-compat.mk
```

Expected files:

```text
makefiles/app.mk
makefiles/config.mk
makefiles/env.mk
makefiles/evidence.mk
makefiles/grafana.mk
makefiles/help.mk
makefiles/k6.mk
makefiles/phase-compat.mk
makefiles/sql.mk
```

- [ ] **Step 2: help와 환경 확인을 실행한다**

Run:

```bash
rtk proxy make help
rtk proxy make env-check
```

Expected help output includes:

```text
K6_PRESET=
GRAFANA_PRESET=
PARTS_DIR=
SQL_OUTPUT=
Compatibility targets:
```

Expected env output:

```text
env-check ok
```

- [ ] **Step 3: k6 공통 target dry-run을 검증한다**

Run:

```bash
rtk proxy make -n k6-run K6_PRESET=baseline MODE=prometheus
rtk proxy make -n k6-run PRESET=baseline MODE=prometheus
rtk proxy make -n k6-evidence PHASE=02-no-lock-baseline K6_PRESET=baseline CONDITION=baseline
rtk proxy make -n k6-evidence PHASE=03-db-strategies/pessimistic-lock K6_PRESET=phase3-pessimistic-baseline CONDITION=baseline
```

Expected output includes:

```text
bash k6/run.sh baseline prometheus
K6_EVIDENCE_PHASE_DIR=02-no-lock-baseline
bash k6/run.sh phase3-pessimistic-baseline prometheus
K6_EVIDENCE_PHASE_DIR=03-db-strategies/pessimistic-lock
```

- [ ] **Step 4: Grafana 공통 target dry-run을 검증한다**

Run:

```bash
rtk proxy make -n grafana-capture PHASE=02-no-lock-baseline GRAFANA_PHASE=phase-02 SCENARIO=no-lock GRAFANA_PRESET=baseline
rtk proxy make -n grafana-capture PHASE=03-db-strategies/pessimistic-lock GRAFANA_PHASE=phase-03 SCENARIO=pessimistic GRAFANA_PRESET=baseline
```

Expected output includes:

```text
--preset baseline
--parts-dir docs/evidence/02-no-lock-baseline/grafana/parts
--phase phase-03
--scenario pessimistic
--parts-dir docs/evidence/03-db-strategies/pessimistic-lock/grafana/parts
```

- [ ] **Step 5: evidence orchestration dry-run을 검증한다**

Run:

```bash
rtk proxy make -n evidence-capture PHASE=03-db-strategies/pessimistic-lock K6_PRESET=phase3-pessimistic-baseline GRAFANA_PHASE=phase-03 SCENARIO=pessimistic GRAFANA_PRESET=baseline CONDITION=baseline
```

Expected output includes this sequence:

```text
make k6-evidence PHASE=03-db-strategies/pessimistic-lock K6_PRESET=phase3-pessimistic-baseline
make grafana-capture PHASE=03-db-strategies/pessimistic-lock GRAFANA_PHASE=phase-03 SCENARIO=pessimistic GRAFANA_PRESET=baseline
make evidence-postprocess PHASE=03-db-strategies/pessimistic-lock
```

- [ ] **Step 6: SQL target dry-run을 검증한다**

Run:

```bash
rtk proxy make -n sql-consistency PHASE=04-db-operational-limits EXPERIMENT=atomic-pool CONDITION=pool-10
rtk proxy make -n sql-consistency PHASE=03-db-strategies/pessimistic-lock SQL_OUTPUT=docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt
```

Expected output includes:

```text
docs/evidence/04-db-operational-limits/atomic-pool/pool-10/sql/consistency.txt
docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt
```

- [ ] **Step 7: compatibility wrapper dry-run을 검증한다**

Run:

```bash
rtk proxy make -n phase3-grafana-capture STRATEGY=pessimistic-lock
rtk proxy make -n phase3-grafana-stitch STRATEGY=pessimistic-lock
rtk proxy make -n phase3-sql-consistency STRATEGY=pessimistic-lock
rtk proxy make -n phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

Expected output includes:

```text
make grafana-capture PHASE=03-db-strategies/pessimistic-lock
make evidence-postprocess PHASE=03-db-strategies/pessimistic-lock
make sql-consistency PHASE=03-db-strategies/pessimistic-lock SQL_OUTPUT=docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt
make sql-consistency PHASE=04-db-operational-limits EXPERIMENT=atomic-pool CONDITION=pool-10
```

- [ ] **Step 8: 기존 저비용 검증을 실행한다**

Run:

```bash
rtk proxy make k6-verify
rtk npm run grafana:test
rtk npm run grafana:generate
rtk docker compose ps grafana
```

Expected:

```text
> node scripts/verify-k6-reservation-responses.js
14 tests pass
concurrency-lab-overview.json
```

`docker compose ps grafana`는 Docker CLI가 인식되는지 확인하는 용도다. Grafana 컨테이너가 떠 있지 않아도 명령 자체가 성공하면 충분하다.

- [ ] **Step 9: 문서와 diff 상태를 확인한다**

Run:

```bash
rtk grep "phase5-grafana\\|phase6-grafana\\|make k6-run PRESET=" Makefile makefiles docs/guides/commands.md docs/guides/project-format-standard.md || true
rtk git diff --check
rtk git status
```

Expected:

```text
```

No forbidden new phase target appears. `git diff --check` exits with status `0`.

- [ ] **Step 10: 최종 커밋한다**

If verification changed generated files, include them. Otherwise commit only remaining verification/doc cleanup changes.

Run:

```bash
rtk git add Makefile makefiles docs/guides/commands.md docs/guides/project-format-standard.md grafana/dashboards/concurrency-lab-overview.json
rtk git commit -m "test: verify makefile command interface"
```

If there are no changes after Step 8, do not create an empty commit.
