# Makefile Command Interface Refactor Design

## 배경

이 프로젝트는 phase별 실험 evidence를 반복해서 만들기 위해 루트 `Makefile`을 공식 실행 인터페이스로 사용한다. 현재 Makefile은 다음 작업을 모두 한 파일에서 관리한다.

- Docker Compose 기반 PostgreSQL, Prometheus, Grafana 실행
- Spring Boot 서버 실행
- k6 preset 실행과 evidence 로그/summary/run-window 생성
- Grafana dashboard JSON 생성
- Grafana dashboard Playwright 캡처
- 캡처 이미지 stitching
- SQL consistency evidence 저장
- phase별 문서/evidence 위치 확인
- k6 reservation response 검증

초기 Phase 2에서는 단일 Makefile이 충분했지만, Phase 3 DB 전략 비교와 Phase 4 운영 한계 실험이 추가되면서 `phase3-grafana-capture`, `phase3-grafana-stitch`, `phase3-sql-consistency`, `phase4-sql-consistency`처럼 phase 이름이 들어간 target이 늘어났다. Phase 5 Redis, Phase 6 Idempotency까지 같은 방식으로 추가하면 Makefile이 phase별 특수 명령 목록으로 변하고, 공통 실행 규칙이 흐려진다.

최근 애플리케이션 코드는 `ReservationStrategy` 기반으로 phase별 구현 drift를 줄였고, Grafana dashboard는 YAML source of truth와 공통 overview dashboard로 정리했다. Makefile도 같은 방향으로 정리해야 한다. 즉, target은 phase 이름이 아니라 작업 종류를 기준으로 정의하고, phase별 차이는 변수와 preset, evidence path로 전달해야 한다.

## 현재 문제

### 1. Makefile이 너무 많은 책임을 가진다

루트 `Makefile` 하나에 환경 확인, 앱 실행, k6, Grafana, SQL, evidence 후처리, phase wrapper가 모두 섞여 있다. 특정 작업을 수정하려면 전체 파일을 읽어야 하고, phase가 늘어날수록 충돌 가능성이 커진다.

### 2. Phase별 target이 계속 늘어날 구조다

현재 Makefile에는 이미 다음과 같은 phase 전용 target이 있다.

```text
phase3-grafana-capture
phase3-grafana-captures
phase3-grafana-stitch
phase3-grafana-stitches
phase3-sql-consistency
phase3-sql-consistencies
phase4-sql-consistency
```

이 target들은 대부분 공통 작업에 phase별 기본값만 입힌 형태다. 새 phase가 추가될 때마다 `phase5-*`, `phase6-*` target을 계속 만들면 명령 체계가 phase 구조에 종속된다.

### 3. `PRESET` 하나가 두 의미를 동시에 가진다

현재 `PRESET`은 두 곳에서 쓰인다.

- k6 preset 파일명: `k6/presets/<preset>.json`
- Grafana dashboard variable: `var-preset=<preset>`

Phase 2 baseline에서는 둘 다 `baseline`이라 문제가 없었다. 하지만 Phase 3에서는 k6 preset 파일명이 `phase3-pessimistic-baseline`이고, Grafana label의 `preset` 값은 `baseline`이다. Phase 4에서도 k6 preset 파일명과 Grafana label 값이 다를 수 있다.

따라서 Makefile에서는 k6 실행 preset과 Grafana variable preset을 분리해서 표현해야 한다.

### 4. `grafana-capture`의 output/run-window 기준이 phase와 느슨하게 연결된다

`scripts/capture-grafana-dashboard.js`는 `--parts-dir`의 상위 디렉터리에서 `run-window-*.json`을 찾는다. 그런데 현재 Makefile의 `grafana-capture`는 `PARTS_DIR`을 명시하지 않으면 캡처 스크립트 기본값인 Phase 2 경로를 사용한다.

공통 target으로 `make grafana-capture PHASE=03-db-strategies/pessimistic-lock` 같은 형태를 안정적으로 지원하려면 Makefile이 `PHASE` 기반 `PARTS_DIR`을 항상 계산해서 넘겨야 한다.

## 목표

- 루트 `Makefile`을 작은 include 파일들의 진입점으로 축소한다.
- Make target은 phase 이름이 아니라 작업 종류를 기준으로 정의한다.
- phase별 차이는 `PHASE`, `GRAFANA_PHASE`, `SCENARIO`, `K6_PRESET`, `GRAFANA_PRESET`, `POOL`, `CONDITION`, `EXPERIMENT`, `STRATEGY` 같은 변수로 전달한다.
- `PRESET`은 기존 문서와 명령 호환을 위해 유지하되, 내부적으로는 `K6_PRESET`과 `GRAFANA_PRESET`의 기본값으로만 사용한다.
- 기존 `phase3-*`, `phase4-*` target은 삭제하지 않고 호환 wrapper로 유지한다.
- 신규 Phase 5/6에서는 phase 전용 Make target을 새로 만들지 않고 공통 target을 사용한다.
- `grafana-capture`는 `PHASE` 기반 parts directory와 run-window directory를 기본으로 사용한다.
- 기존 `make help`, `make k6-run`, `make k6-evidence`, `make grafana-capture`, `make evidence-capture`, `make k6-verify` 명령은 계속 동작한다.
- 문서와 runbook은 새 공통 명령을 기준으로 점진적으로 갱신할 수 있어야 한다.

## 비목표

- 이번 변경에서 k6 preset JSON 포맷을 바꾸지 않는다.
- 이번 변경에서 Grafana dashboard YAML 구조를 바꾸지 않는다.
- 이번 변경에서 `scripts/capture-grafana-dashboard.js`의 CLI 계약을 바꾸지 않는다.
- 이번 변경에서 `k6/run.sh`를 Node.js runner로 교체하지 않는다.
- 이번 변경에서 기존 phase evidence 디렉터리 구조를 이동하지 않는다.
- 이번 변경에서 기존 phase runbook의 모든 과거 명령을 한 번에 rewrite하지 않는다.
- 이번 변경에서 새 Phase 5/6 실험 명령을 구현하지 않는다.

## 결정

Makefile command interface를 "공통 작업 target + 명시적 변수" 구조로 리팩토링한다.

루트 `Makefile`은 shell 설정, 기본 goal, include 선언만 가진다. 실제 target은 `makefiles/*.mk`로 나눈다.

```text
Makefile
makefiles/
  config.mk
  help.mk
  env.mk
  app.mk
  k6.mk
  grafana.mk
  evidence.mk
  sql.mk
  phase-compat.mk
```

각 파일의 책임은 다음과 같다.

| File | Responsibility |
|---|---|
| `Makefile` | shell 설정, `.DEFAULT_GOAL`, include 순서 |
| `makefiles/config.mk` | 공통 변수 기본값과 파생 변수 |
| `makefiles/help.mk` | `help` target 출력 |
| `makefiles/env.mk` | `env-check`, `db-start` |
| `makefiles/app.mk` | `server-start` |
| `makefiles/k6.mk` | `k6-run`, `k6-evidence`, `k6-verify` |
| `makefiles/grafana.mk` | `grafana-generate`, `grafana-capture` |
| `makefiles/evidence.mk` | `evidence-capture`, `evidence-postprocess`, `grafana-stitch`, `phase-status` |
| `makefiles/sql.mk` | `sql-consistency` |
| `makefiles/phase-compat.mk` | 기존 phase 전용 wrapper |

## Target 정책

새 target은 phase 이름이 아니라 작업 종류를 기준으로 만든다.

권장 target 형태:

```text
k6-run
k6-evidence
grafana-generate
grafana-capture
evidence-capture
evidence-postprocess
grafana-stitch
sql-consistency
phase-status
```

새로 만들지 않을 target 형태:

```text
phase5-grafana-capture
phase5-sql-consistency
phase6-grafana-capture
phase6-idempotency-capture
```

phase별 편의 명령이 필요하더라도 먼저 공통 target과 변수 조합으로 표현한다. wrapper는 이미 공개된 과거 명령을 유지하기 위한 호환 레이어로만 둔다.

## 변수 계약

### 공통 phase/evidence 변수

| Variable | Meaning | Example |
|---|---|---|
| `PHASE` | `docs/evidence/<PHASE>`와 `docs/phases/<PHASE>`에 쓰는 phase/evidence path | `03-db-strategies/pessimistic-lock` |
| `GRAFANA_PHASE` | Grafana `phase` dashboard variable과 Prometheus label | `phase-03` |
| `SCENARIO` | Grafana/k6 `scenario` label | `pessimistic` |
| `POOL` | Grafana/k6 `pool` label | `default`, `10`, `50` |
| `CONDITION` | evidence run id prefix | `pool-10`, `timeout-500` |

`PHASE`는 파일 경로이고, `GRAFANA_PHASE`는 metric label이다. 두 값을 합치지 않는다.

### Preset 변수

| Variable | Meaning | Example |
|---|---|---|
| `PRESET` | 기존 호환용 기본 preset 값 | `baseline` |
| `K6_PRESET` | `k6/presets/<K6_PRESET>.json` 파일명 | `phase3-pessimistic-baseline` |
| `GRAFANA_PRESET` | Grafana `preset` variable과 Prometheus label | `baseline` |

기본값은 다음처럼 둔다.

```make
PRESET ?= baseline
K6_PRESET ?= $(PRESET)
GRAFANA_PRESET ?= $(PRESET)
```

Phase 3 예시는 다음과 같다.

```bash
make k6-evidence \
  PHASE=03-db-strategies/pessimistic-lock \
  K6_PRESET=phase3-pessimistic-baseline

make grafana-capture \
  PHASE=03-db-strategies/pessimistic-lock \
  GRAFANA_PHASE=phase-03 \
  SCENARIO=pessimistic \
  GRAFANA_PRESET=baseline
```

일반적인 evidence flow에서는 k6가 생성한 run-window JSON에 `phase`, `scenario`, `preset`, `pool` label이 들어 있으므로 `RUN_WINDOW=auto` 캡처가 해당 값을 우선 적용한다. 그래도 live capture나 explicit time range capture에서는 Makefile 변수가 필요하므로 `GRAFANA_PRESET`은 별도로 유지한다.

### Grafana capture 변수

| Variable | Meaning | Default |
|---|---|---|
| `DASHBOARD` | capture할 dashboard key | `overview` |
| `RUN_WINDOW` | `auto`, `0`, 또는 run-window JSON 경로 | `auto` |
| `PARTS_DIR` | dashboard part screenshot output directory | `docs/evidence/$(PHASE)/grafana/parts` |
| `TABLE` | Grafana table variable | empty |
| `URI` | Grafana uri variable | empty |

`grafana-capture`는 `PARTS_DIR`을 항상 넘긴다. 이렇게 해야 `RUN_WINDOW=auto`가 `docs/evidence/<PHASE>/grafana`에서 최신 run-window JSON을 찾는다.

### SQL evidence 변수

| Variable | Meaning | Default |
|---|---|---|
| `EXPERIMENT` | phase 안의 실험 그룹 | empty |
| `SQL_CONDITION` | SQL evidence 조건 이름. 기본은 `CONDITION`과 같다. | `$(CONDITION)` |
| `SQL_OUTPUT` | SQL consistency 결과 파일 경로 | `docs/evidence/$(PHASE)/$(EXPERIMENT)/$(SQL_CONDITION)/sql/consistency.txt` |

`sql-consistency`는 기본적으로 Phase 4처럼 `PHASE/EXPERIMENT/CONDITION` 구조에 저장한다. Phase 3처럼 기존 evidence path가 다른 경우에는 wrapper가 `SQL_OUTPUT`을 명시해서 같은 공통 target을 사용한다.

## 공통 Target 설계

### `k6-run`

목적: k6 preset을 실행한다. preset의 `evidenceDir` 기본값을 따른다.

```bash
make k6-run K6_PRESET=baseline MODE=prometheus
make k6-run K6_PRESET=phase3-pessimistic-baseline MODE=prometheus
```

실행 형태:

```make
POOL=$(POOL) K6_TAIL_LINES=$(TAIL) bash k6/run.sh $(K6_PRESET) $(MODE)
```

### `k6-evidence`

목적: `PHASE`와 `CONDITION`을 명시해 evidence run id와 output path를 고정한다.

```bash
make k6-evidence \
  PHASE=04-db-operational-limits/atomic-pool/pool-10 \
  K6_PRESET=phase4-atomic-pool \
  CONDITION=pool-10
```

실행 형태:

```make
POOL=$(POOL) \
K6_EVIDENCE_PHASE_DIR=$(PHASE) \
K6_TAIL_LINES=$(TAIL) \
K6_RUN_ID="$(CONDITION)-$$(date +%Y%m%d-%H%M%S)" \
bash k6/run.sh $(K6_PRESET) $(MODE)
```

### `grafana-capture`

목적: Grafana overview dashboard를 phase/evidence path 기준으로 캡처한다.

```bash
make grafana-capture \
  PHASE=03-db-strategies/pessimistic-lock \
  GRAFANA_PHASE=phase-03 \
  SCENARIO=pessimistic \
  GRAFANA_PRESET=baseline
```

실행 형태:

```make
npm run grafana:capture -- \
  --dashboard $(DASHBOARD) \
  --phase $(GRAFANA_PHASE) \
  --scenario $(SCENARIO) \
  --preset $(GRAFANA_PRESET) \
  --pool $(POOL) \
  --run-window $(RUN_WINDOW) \
  --parts-dir $(PARTS_DIR)
```

`TABLE`, `URI`는 값이 있을 때만 넘긴다.

### `evidence-capture`

목적: k6 evidence 실행, Grafana capture, stitching을 한 번에 수행한다.

```bash
make evidence-capture \
  PHASE=03-db-strategies/pessimistic-lock \
  K6_PRESET=phase3-pessimistic-baseline \
  GRAFANA_PHASE=phase-03 \
  SCENARIO=pessimistic \
  GRAFANA_PRESET=baseline \
  CONDITION=baseline
```

`evidence-capture`는 내부에서 공통 target만 호출한다.

```text
evidence-capture
  -> k6-evidence
  -> grafana-capture
  -> evidence-postprocess
```

### `sql-consistency`

목적: SQL consistency evidence를 phase/experiment/condition path에 저장한다.

```bash
make sql-consistency \
  PHASE=04-db-operational-limits \
  EXPERIMENT=atomic-pool \
  CONDITION=pool-10
```

출력 경로:

```text
$(SQL_OUTPUT)
```

기본값은 다음과 같다.

```text
docs/evidence/<PHASE>/<EXPERIMENT>/<SQL_CONDITION>/sql/consistency.txt
```

Phase 3처럼 strategy path에 바로 SQL evidence를 남겨야 하는 경우는 wrapper가 `SQL_OUTPUT`을 명시해서 공통 target으로 위임한다.

## 호환 Wrapper 설계

기존 phase 전용 target은 당장 삭제하지 않는다. 대신 내부 구현을 공통 target 호출로 바꾼다.

### Phase 3 Grafana wrapper

기존 명령:

```bash
make phase3-grafana-capture STRATEGY=pessimistic-lock
```

wrapper는 `STRATEGY`를 다음 값으로 매핑한다.

| `STRATEGY` | `PHASE` | `GRAFANA_PHASE` | `SCENARIO` | `GRAFANA_PRESET` |
|---|---|---|---|---|
| `pessimistic-lock` | `03-db-strategies/pessimistic-lock` | `phase-03` | `pessimistic` | `baseline` |
| `optimistic-lock` | `03-db-strategies/optimistic-lock` | `phase-03` | `optimistic` | `baseline` |
| `atomic-update` | `03-db-strategies/atomic-update` | `phase-03` | `atomic` | `baseline` |

이 wrapper는 직접 `npm run grafana:capture`를 호출하지 않고 `$(MAKE) grafana-capture ...`로 위임한다.

### Phase 3 stitch wrapper

기존 명령:

```bash
make phase3-grafana-stitch STRATEGY=pessimistic-lock
```

wrapper는 다음 공통 명령으로 위임한다.

```bash
make evidence-postprocess PHASE=03-db-strategies/pessimistic-lock
```

### Phase 3 SQL wrapper

기존 명령:

```bash
make phase3-sql-consistency STRATEGY=pessimistic-lock
```

wrapper는 다음 공통 명령으로 위임한다.

```bash
make sql-consistency \
  PHASE=03-db-strategies/pessimistic-lock \
  SQL_OUTPUT=docs/evidence/03-db-strategies/pessimistic-lock/sql/baseline-consistency.txt
```

### Phase 4 SQL wrapper

기존 명령:

```bash
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

wrapper는 다음 공통 명령으로 위임한다.

```bash
make sql-consistency PHASE=04-db-operational-limits EXPERIMENT=atomic-pool CONDITION=pool-10
```

## Help 출력 정책

`make help`는 모든 내부 wrapper를 같은 수준으로 길게 나열하지 않는다.

우선순위는 다음과 같다.

1. 공통 target과 핵심 변수
2. 자주 쓰는 예시
3. Legacy compatibility target 목록

예시:

```text
Common targets:
  make k6-run K6_PRESET=baseline MODE=prometheus
  make k6-evidence PHASE=... K6_PRESET=... CONDITION=...
  make grafana-capture PHASE=... GRAFANA_PHASE=... SCENARIO=...
  make evidence-capture PHASE=... K6_PRESET=...
  make sql-consistency PHASE=... EXPERIMENT=... CONDITION=...

Compatibility targets:
  make phase3-grafana-capture STRATEGY=pessimistic-lock
  make phase3-grafana-stitch STRATEGY=pessimistic-lock
  make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

이렇게 하면 새 사용자는 공통 명령을 먼저 보고, 기존 문서를 재현해야 하는 사용자는 compatibility target을 계속 찾을 수 있다.

## 문서 갱신 범위

이번 리팩토링과 함께 최소한 다음 문서를 갱신한다.

- `docs/guides/commands.md`
- `docs/guides/project-format-standard.md`

갱신 원칙:

- 새 설명은 공통 target 기준으로 작성한다.
- 기존 phase runbook의 과거 재현 명령은 한 번에 모두 바꾸지 않는다.
- Phase 3/4 runbook에 새 공통 명령 예시를 추가할 수는 있지만, 기존 명령이 wrapper로 동작하는 동안 삭제는 필수가 아니다.

## 검증 전략

Makefile 리팩토링은 shell orchestration 변경이므로 실제 명령 해석 검증이 중요하다.

필수 검증:

```bash
make help
make env-check
make k6-verify
make grafana-generate
```

가능하면 다음 dry-run 또는 저비용 명령도 확인한다.

```bash
make -n k6-run K6_PRESET=baseline MODE=prometheus
make -n k6-evidence PHASE=02-no-lock-baseline K6_PRESET=baseline CONDITION=baseline
make -n grafana-capture PHASE=02-no-lock-baseline GRAFANA_PHASE=phase-02 SCENARIO=no-lock GRAFANA_PRESET=baseline
make -n phase3-grafana-capture STRATEGY=pessimistic-lock
make -n phase3-grafana-stitch STRATEGY=pessimistic-lock
make -n phase3-sql-consistency STRATEGY=pessimistic-lock
make -n phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
```

`make -n`에서 확인할 핵심은 다음이다.

- `k6-run`이 `$(K6_PRESET)`을 사용한다.
- `grafana-capture`가 `--preset $(GRAFANA_PRESET)`을 사용한다.
- `grafana-capture`가 `--parts-dir docs/evidence/$(PHASE)/grafana/parts`를 항상 넘긴다.
- `phase3-sql-consistency`가 `SQL_OUTPUT`을 통해 기존 Phase 3 SQL evidence 경로를 유지한다.
- phase compatibility target이 직접 스크립트를 실행하지 않고 공통 target으로 위임한다.

Docker와 Grafana가 실행 중인 환경에서는 기존 실제 검증도 유지한다.

```bash
npm run grafana:test
npm run grafana:generate
docker compose ps grafana
```

## 마이그레이션 순서

1. `makefiles/config.mk`를 만들고 기존 변수 기본값을 이동한다.
2. 루트 `Makefile`을 shell 설정과 include 중심으로 축소한다.
3. 기존 target을 기능별 `makefiles/*.mk`로 이동하되 동작을 바꾸지 않는다.
4. `PRESET`을 `K6_PRESET`/`GRAFANA_PRESET`으로 분리하고 기존 `PRESET` 호환 기본값을 유지한다.
5. `grafana-capture`가 `PHASE` 기반 `PARTS_DIR`을 항상 넘기도록 바꾼다.
6. `phase3-*`, `phase4-*` target을 공통 target wrapper로 바꾼다.
7. `make help`를 공통 target 중심으로 재정리한다.
8. 명령 가이드 문서를 새 변수 계약에 맞게 갱신한다.
9. Makefile dry-run과 저비용 검증 명령을 실행한다.

## 예상 결과

리팩토링 후 사용자는 새 phase에서도 phase 전용 Make target을 만들지 않고 다음 형태로 evidence를 수집할 수 있다.

```bash
make evidence-capture \
  PHASE=06-idempotency/duplicate-request \
  K6_PRESET=phase6-idempotency-duplicate-request \
  GRAFANA_PHASE=phase-06 \
  SCENARIO=idempotency \
  GRAFANA_PRESET=duplicate-request \
  CONDITION=baseline
```

기존 Phase 3 재현 명령도 계속 동작한다.

```bash
make phase3-grafana-capture STRATEGY=pessimistic-lock
make phase3-grafana-stitch STRATEGY=pessimistic-lock
```

이 구조는 Makefile을 phase별 명령 저장소가 아니라, 공통 evidence orchestration 인터페이스로 유지한다.
