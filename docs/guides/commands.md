# Commands Guide

이 문서는 사람이 반복 실행할 공식 명령을 정리한다. 기본 진입점은 루트 `Makefile`이다.

```bash
make help
```

`package.json` scripts와 `scripts/`, `k6/` 파일은 내부 구현 레이어다. 디버깅이나 스크립트 개발이 아니라면 먼저 `make` target을 사용한다.

## Prerequisites

- Docker와 Docker Compose
- Java 21
- Node.js와 npm
- Python 3
- bash
- 로컬 Spring Boot 서버가 필요한 k6 실행에서는 `localhost:8080` 서버

환경 확인:

```bash
make env-check
```

## Common Variables

| Variable | Default | Purpose |
|---|---|---|
| `PHASE` | `02-no-lock-baseline` | 문서/evidence phase 디렉토리 |
| `GRAFANA_PHASE` | `phase-02` | Grafana dashboard phase variable |
| `SCENARIO` | `no-lock` | 시나리오 label |
| `PRESET` | `baseline` | `k6/presets/<preset>.json` 이름 |
| `MODE` | `prometheus` | k6 실행 모드. `prometheus` 또는 `local` |
| `POOL` | `default` | pool label |
| `POOL_SIZE` | `10` | Spring Boot 서버의 HikariCP maximum pool size |
| `LOCK_TIMEOUT` | `0` | Spring Boot 서버 connection의 PostgreSQL lock timeout. 숫자만 쓰며 단위는 ms |
| `PROFILE` | `local` | Spring profile |
| `PORT` | `8080` | Spring Boot port |
| `CONDITION` | `baseline` | evidence run id prefix |
| `TAIL` | `120` | k6 tail 출력 줄 수 |
| `PYTHON` | `python.exe` | image stitching에 사용할 Python 실행 파일 |
| `DASHBOARD` | `phase2` | Grafana dashboard key |
| `RUN_WINDOW` | `auto` | Grafana 캡처 시간 구간 |

## Environment

DB와 관측 도구를 실행한다.

```bash
make db-start
```

Spring Boot 서버를 실행한다.

```bash
make server-start
make server-start PROFILE=local PORT=8080
make server-start POOL_SIZE=10 LOCK_TIMEOUT=500
```

`LOCK_TIMEOUT=0`은 PostgreSQL 기본값인 무제한 lock wait를 의미한다.

## k6

기본 Phase 2 baseline을 Prometheus remote write 모드로 실행한다.

```bash
make k6-run
```

다른 preset을 실행한다.

```bash
make k6-run PRESET=spike MODE=prometheus
make k6-run PRESET=ramp-up MODE=local
make k6-run PRESET=sustained MODE=prometheus
```

Evidence run id에 조건 이름을 포함해 실행한다.

```bash
make k6-evidence PHASE=02-no-lock-baseline PRESET=baseline CONDITION=pool-default-baseline
```

기본 결과 위치:

| Output | Path |
|---|---|
| k6 summary JSON | `docs/evidence/<PHASE>/k6/` |
| k6 terminal log | `docs/evidence/<PHASE>/logs/` |
| Grafana run window | `docs/evidence/<PHASE>/grafana/run-window-*.json` |

## Grafana

Dashboard JSON을 생성한다.

```bash
make grafana-generate
```

최근 k6 run window 기준으로 Phase 2 dashboard를 캡처한다.

```bash
make grafana-capture
```

Grafana table variable을 지정한다.

```bash
make grafana-capture TABLE=concert
```

Phase 3 strategy overview dashboard capture:

```bash
make phase3-grafana-capture STRATEGY=pessimistic-lock
make phase3-grafana-capture STRATEGY=optimistic-lock
make phase3-grafana-capture STRATEGY=atomic-update
```

Phase 3 strategy dashboard stitching:

```bash
make phase3-grafana-stitch STRATEGY=pessimistic-lock
make phase3-grafana-stitch STRATEGY=optimistic-lock
make phase3-grafana-stitch STRATEGY=atomic-update
```

All Phase 3 strategy captures can be stitched with one command:

```bash
make phase3-grafana-stitches
```

Phase 3 SQL consistency evidence:

```bash
make phase3-sql-consistency STRATEGY=pessimistic-lock
make phase3-sql-consistency STRATEGY=optimistic-lock
make phase3-sql-consistency STRATEGY=atomic-update
```

Phase 4 SQL consistency evidence:

```bash
make phase4-sql-consistency EXPERIMENT=atomic-pool CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=pessimistic-pool CONDITION=pool-10
make phase4-sql-consistency EXPERIMENT=pessimistic-timeout CONDITION=timeout-500
```

If Pillow is installed in a different Python, override the interpreter:

```bash
make phase3-grafana-stitches PYTHON=python3
```

live 구간을 직접 캡처해야 할 때만 `RUN_WINDOW=0`을 쓰고, 내부 스크립트 옵션의 `--live`가 필요하면 `npm run grafana:capture`로 디버깅한다.

캡처 결과 기본 위치:

```text
docs/evidence/02-no-lock-baseline/grafana/parts/
```

## Evidence Capture

k6 실행, Grafana 캡처, 이미지 stitch를 한 번에 수행한다.

```bash
make evidence-capture PHASE=02-no-lock-baseline PRESET=baseline CONDITION=pool-default-baseline
```

캡처 후 stitch만 다시 수행한다.

```bash
make evidence-postprocess PHASE=02-no-lock-baseline
make grafana-stitch PHASE=02-no-lock-baseline
```

출력 경로를 지정한다.

```bash
make evidence-postprocess \
  PHASE=02-no-lock-baseline \
  OUTPUT=docs/evidence/02-no-lock-baseline/grafana/stitched-dashboard.png
```

## Phase Status

현재 phase 문서와 evidence 위치를 확인한다.

```bash
make phase-status PHASE=02-no-lock-baseline
```

## Validation

k6 예약 응답 기대값을 검증한다.

```bash
make k6-verify
```

이 target은 내부적으로 `scripts/verify-k6-reservation-responses.js`를 실행한다.

## Internal Implementation Mapping

반복 실행할 때 이 파일들을 직접 호출하지 않는다. Make target이 감싸는 구현 파일만 빠르게 확인할 수 있도록 둔다.

| Make target | Internal file or script |
|---|---|
| `k6-run`, `k6-evidence` | `k6/run.sh`, `k6/reservation-test.js`, `k6/presets/*.json` |
| `grafana-generate` | `scripts/generate-grafana-dashboards.js` |
| `grafana-capture`, `phase3-grafana-capture`, `phase3-grafana-captures` | `scripts/capture-grafana-dashboard.js` |
| `evidence-postprocess`, `grafana-stitch`, `phase3-grafana-stitch`, `phase3-grafana-stitches` | `scripts/stitch-grafana-captures.py` |
| `sql-consistency`, `phase3-sql-consistency`, `phase3-sql-consistencies`, `phase4-sql-consistency` | `scripts/sql/consistency-check.sql` |
| `k6-verify` | `scripts/verify-k6-reservation-responses.js` |
