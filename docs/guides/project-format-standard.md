# Project Format Standard

여러 Learning Phase 프로젝트에서 동일한 문서 구조와 실행 인터페이스를 사용하기 위한 표준이다.

## 목적

프로젝트마다 내부 구현, 프레임워크, 스크립트 파일명은 달라도 사람이 사용하는 구조와 명령은 같아야 한다.

이 프로젝트에서는 루트 `Makefile`을 공식 실행 인터페이스로 둔다. `package.json` scripts와 `scripts/`, `k6/` 파일은 내부 구현 레이어로 유지한다.

## 기본 원칙

- 공식 반복 실행 인터페이스는 루트 `Makefile`이다.
- `make help`는 항상 사용 가능한 target, 변수, 예시, 결과 위치를 보여준다.
- `package.json` scripts는 Node 기반 내부 작업 이름으로 유지한다.
- `scripts/`와 `k6/`는 실제 구현 파일을 둔다. 반복 작업에서 사람이 먼저 직접 실행하지 않는다.
- phase 문서는 `docs/phases/`에서 시작한다.
- 실험 결과, 로그, 스크린샷은 `docs/evidence/`에 저장한다.
- 반복 적용되는 의사결정은 `docs/adr/`에 남긴다.
- Superpowers 산출물은 `docs/superpowers/specs/`, `docs/superpowers/plans/`에 둔다.

## 현재 프로젝트 구조

```text
.
├── Makefile
├── package.json
├── k6/
│   ├── presets/
│   ├── reservation-test.js
│   └── run.sh
├── scripts/
│   ├── capture-grafana-dashboard.js
│   ├── generate-grafana-dashboards.js
│   ├── stitch-grafana-captures.py
│   ├── test_stitch_grafana_captures.py
│   ├── verify-k6-reservation-responses.js
│   └── sql/
├── docs/
│   ├── README.md
│   ├── adr/
│   ├── agents/
│   ├── evidence/
│   ├── guides/
│   │   ├── commands.md
│   │   └── project-format-standard.md
│   ├── phases/
│   └── superpowers/
```

기존 스크립트 파일은 이번 표준화에서 이동하지 않는다. 새 phase에서 스크립트가 늘어나면 기능별 하위 디렉토리 구조를 적용한다.

## Makefile 계약

루트에서 다음 명령을 지원한다.

```bash
make help
```

`make help`는 다음 정보를 보여준다.

- 사용 가능한 target 목록
- target별 주요 변수
- 대표 실행 예시
- 결과물이 저장되는 기본 위치

## 현재 지원 Target

| Target | Purpose | Required Variables | Common Optional Variables |
|---|---|---|---|
| `help` | 사용 가능한 명령 목록 출력 | - | - |
| `env-check` | 필수 도구와 실행 환경 확인 | - | - |
| `db-start` | DB와 관측 도구 실행 | - | `PROFILE` |
| `server-start` | Spring Boot 서버 실행 | - | `PROFILE`, `PORT`, `POOL_SIZE`, `LOCK_TIMEOUT` |
| `k6-run` | k6 preset 실행 | - | `K6_PRESET`, `PRESET`, `MODE`, `TAIL`, `POOL` |
| `k6-evidence` | evidence run id를 명시해 k6 실행 | - | `PHASE`, `K6_PRESET`, `PRESET`, `MODE`, `CONDITION`, `TAIL`, `POOL` |
| `evidence-capture` | k6 실행 후 Grafana 캡처와 stitch 수행 | - | `PHASE`, `K6_PRESET`, `GRAFANA_PHASE`, `SCENARIO`, `GRAFANA_PRESET`, `POOL`, `CONDITION`, `TABLE`, `URI`, `OUTPUT` |
| `grafana-generate` | Grafana dashboard JSON 생성 | - | - |
| `grafana-capture` | Grafana dashboard viewport part 캡처 | - | `DASHBOARD`, `GRAFANA_PHASE`, `SCENARIO`, `GRAFANA_PRESET`, `POOL`, `RUN_WINDOW`, `TABLE`, `URI`, `PARTS_DIR` |
| `evidence-postprocess` | Grafana 캡처 이미지 stitch | - | `PHASE`, `INPUT`, `OUTPUT` |
| `grafana-stitch` | `evidence-postprocess` alias | - | `PHASE`, `INPUT`, `OUTPUT` |
| `sql-consistency` | counted-seat consistency SQL evidence 저장 | `PHASE`, `CONDITION`, `SQL_CONDITION`, `SQL_OUTPUT` | `EXPERIMENT` |
| `phase4-sql-consistency` | Phase 4 consistency SQL evidence 저장 | `EXPERIMENT`, `CONDITION` | - |
| `phase-status` | phase 문서와 evidence 상태 확인 | - | `PHASE` |
| `k6-verify` | k6 예약 응답 기대값 검증 | - | - |

프로젝트에 아직 없는 기능인 `seed`, `db-reset`, `server-stop`, `server-logs` target은 만들지 않는다.

## 표준 변수 이름

| Variable | Meaning | Default |
|---|---|---|
| `PHASE` | 문서/evidence phase 디렉토리 | `02-no-lock-baseline` |
| `GRAFANA_PHASE` | Grafana dashboard phase variable | `phase-02` |
| `SCENARIO` | k6 또는 실험 시나리오 | `no-lock` |
| `PRESET` | 기존 호환용 preset 값. `K6_PRESET`, `GRAFANA_PRESET` 기본값으로 사용 | `baseline` |
| `K6_PRESET` | k6 preset JSON 파일명 | `$(PRESET)` |
| `GRAFANA_PRESET` | Grafana dashboard preset variable | `$(PRESET)` |
| `MODE` | k6 실행 모드 | `prometheus` |
| `POOL` | connection pool preset label | `default` |
| `POOL_SIZE` | Spring Boot HikariCP maximum pool size | `10` |
| `LOCK_TIMEOUT` | PostgreSQL lock timeout in milliseconds for Spring Boot connections | `0` |
| `PROFILE` | Spring profile | `local` |
| `PORT` | Spring Boot server port | `8080` |
| `CONDITION` | evidence 조건 이름 | `baseline` |
| `TABLE` | Grafana table variable | empty |
| `DASHBOARD` | dashboard 이름 | `phase2` |
| `RUN_WINDOW` | Grafana run-window JSON | `auto` |
| `PARTS_DIR` | Grafana part screenshot output directory | `docs/evidence/<PHASE>/grafana/parts` |
| `SQL_CONDITION` | SQL evidence 조건 이름 | `$(CONDITION)` |
| `SQL_OUTPUT` | SQL consistency output file | `docs/evidence/<PHASE>/<EXPERIMENT>/<SQL_CONDITION>/sql/consistency.txt` |
| `OUTPUT` | 후처리 출력 경로 | empty |
| `INPUT` | 후처리 입력 디렉토리 | empty |
| `TAIL` | k6 로그 tail 줄 수 | `120` |
| `EXPERIMENT` | evidence 실험 분류 | empty |

`PHASE`는 현재 repo의 기존 디렉토리 이름을 따른다. Grafana/k6 metric label의 phase 값은 `GRAFANA_PHASE=phase-02`처럼 별도 변수로 둔다.

## Migration Policy

기존 프로젝트는 한 번에 구조를 바꾸지 않는다.

1. 기존 실행 명령은 Makefile에서 먼저 감싼다.
2. 기존 `scripts/`와 `k6/` 파일은 이동하지 않는다.
3. 반복 실행 문서는 `docs/guides/commands.md`에서 `make` 기준으로 안내한다.
4. 내부 구현 파일 매핑은 필요할 때 `docs/guides/commands.md`의 보조 섹션에만 짧게 둔다.
5. 새 phase에서 스크립트가 늘어나면 `scripts/server/`, `scripts/load/`, `scripts/observability/`, `scripts/evidence/` 같은 기능별 하위 디렉토리를 적용한다.

신규 phase에서는 `phase5-*`, `phase6-*` 형식의 Make target을 추가하지 않는다. 공통 target과 명시적 변수 조합으로 실행하고, 이미 공개된 phase 전용 target은 compatibility wrapper로만 유지한다.

## 금지 규칙

- 반복 실행 명령을 `Makefile`, `package.json`, README에 서로 다른 이름으로 중복 정의하지 않는다.
- evidence 파일을 프로젝트 루트나 임시 디렉토리에 남기지 않는다.
- phase별 실행 절차를 README 본문에만 숨기지 않는다.
- 사람이 매번 `scripts/` 파일명을 직접 찾아 실행해야 하는 구조로 두지 않는다.
