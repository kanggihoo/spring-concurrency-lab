# Scripts Guide

이 문서는 로컬 실험에서 사용하는 실행 스크립트의 진입점을 정리한다.

## k6 Load Test

k6 부하 테스트는 `k6/run.sh`로 실행한다. 실행 파라미터는 `k6/presets/*.json`에 두고, 공통 실행 로직은 `k6/reservation-test.js`가 담당한다.

PowerShell에서는 `bash`를 앞에 붙여 실행한다.

```powershell
bash k6/run.sh baseline prometheus
```

Git Bash에서는 직접 실행할 수 있다.

```bash
./k6/run.sh baseline prometheus
```

명령 형식은 다음과 같다.

```bash
bash k6/run.sh <preset> <mode>
```

첫 번째 인자 `<preset>`은 `k6/presets/<preset>.json` 파일 이름이다. 두 번째 인자 `<mode>`는 k6 실행 방식이다.

## Presets

| Preset | File | Purpose |
|---|---|---|
| `baseline` | `k6/presets/baseline.json` | Phase 2 필수 기준 부하. reset과 consistency snapshot을 수행한다. |
| `spike` | `k6/presets/spike.json` | 짧은 시간에 트래픽을 급증시킨다. |
| `ramp-up` | `k6/presets/ramp-up.json` | VU를 단계적으로 늘려 한계 구간을 찾는다. |
| `sustained` | `k6/presets/sustained.json` | 긴 시간 동안 DB와 런타임 압력을 관찰한다. |

## Modes

| Mode | Command | Use Case |
|---|---|---|
| `prometheus` | `bash k6/run.sh baseline prometheus` | Docker Compose의 `k6` 서비스로 실행하고 Prometheus remote write를 사용한다. 실험 evidence 수집은 이 모드를 기본으로 한다. |
| `local` | `bash k6/run.sh baseline local` | 로컬 `k6` 바이너리가 있으면 직접 실행한다. 없으면 `docker run grafana/k6`로 실행한다. 빠른 확인용이다. |

`prometheus` 모드는 다음 서비스가 먼저 실행되어 있어야 한다.

```powershell
docker compose up -d postgres postgres_exporter prometheus grafana
```

Spring Boot 애플리케이션도 호스트에서 `localhost:8080`으로 실행되어 있어야 한다.

```powershell
cd concurrency
.\gradlew.bat bootRun
```

Docker Compose의 k6 서비스는 `K6_PROMETHEUS_RW_TREND_STATS=p(95),p(99)`로 설정되어 있다. 따라서 새 k6 실행부터 Prometheus에 `k6_http_req_duration_p95`와 `k6_http_req_duration_p99`가 기록된다.

## Common Commands

```powershell
bash k6/run.sh baseline prometheus
bash k6/run.sh spike prometheus
bash k6/run.sh ramp-up prometheus
bash k6/run.sh sustained prometheus
```

## Evidence Outputs

실행 산출물은 기본적으로 `docs/evidence/<evidenceDir>/` 아래에 저장된다. Phase 2 preset은 `evidenceDir` 값이 `02-no-lock-baseline`이다.

| Output | Default Path |
|---|---|
| k6 summary JSON | `docs/evidence/02-no-lock-baseline/k6/<preset>-<mode>-<run-id>-summary.json` |
| k6 terminal log | `docs/evidence/02-no-lock-baseline/logs/<preset>-<mode>-<run-id>.log` |
| Grafana run window | `docs/evidence/02-no-lock-baseline/grafana/run-window-<preset>-<mode>-<run-id>.json` |

`run-window-*.json`은 Grafana 캡처에 사용할 시간 범위다. `grafanaFrom`과 `grafanaTo`를 Playwright 캡처 스크립트의 `from`, `to` 값으로 연결할 수 있다.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | Docker: `http://host.docker.internal:8080`, local k6: `http://localhost:8080` | k6가 호출할 Spring Boot base URL |
| `K6_RESULTS_DIR` | `docs/evidence/<evidenceDir>/k6` | k6 summary JSON 저장 위치 |
| `K6_LOGS_DIR` | `docs/evidence/<evidenceDir>/logs` | k6 terminal log 저장 위치 |
| `K6_GRAFANA_DIR` | `docs/evidence/<evidenceDir>/grafana` | Grafana run window 저장 위치 |
| `K6_LOG_FILE` | `<logs>/<preset>-<mode>-<run-id>.log` | k6 로그 파일 경로 |
| `K6_SUMMARY_FILE` | `<k6-results>/<preset>-<mode>-<run-id>-summary.json` | k6 summary JSON 경로 |
| `K6_RUN_ID` | current local timestamp, `yyyyMMdd-HHmmss` | evidence 파일명에 쓰는 run id |
| `K6_TAIL_ONLY` | `0` | `1`이면 전체 로그를 파일에만 쓰고 마지막 줄만 출력한다. |
| `K6_TAIL_LINES` | `120` | `K6_TAIL_ONLY=1`일 때 출력할 마지막 줄 수 |
| `K6_RUN_WINDOW_FILE` | `auto` | run window JSON 저장 경로. `0`이면 저장하지 않는다. |

## Grafana

대시보드 JSON은 generator가 source of truth다.

```powershell
npm run grafana:generate
```

Phase 2 대시보드 캡처는 다음 명령으로 실행한다.

```powershell
npm run grafana:capture:phase2
```

이 명령은 기본적으로 `docs/evidence/02-no-lock-baseline/grafana/` 아래의 최신 `run-window-*.json`을 읽어 k6 실행 구간으로 `from`/`to`를 고정한다. 캡처 결과는 `docs/evidence/02-no-lock-baseline/grafana/parts/`에 저장된다.

live 구간을 직접 캡처해야 할 때만 다음처럼 실행한다.

```powershell
npm run grafana:capture -- --dashboard phase2 --run-window 0 --live
```

캡처된 `parts/*.png` 파일을 하나의 긴 이미지로 합칠 때는 다음 명령을 사용한다.

```powershell
npm run grafana:stitch:phase2
```

기본 입력은 `docs/evidence/02-no-lock-baseline/grafana/parts/`이고, 기본 출력은 `docs/evidence/02-no-lock-baseline/grafana/stitched-dashboard.png`이다. 스크립트는 `parts/capture-meta.json`을 자동으로 읽어서 실제 스크롤 offset 기준으로 이미지를 이어 붙인다.

다른 phase나 경로를 직접 지정해야 하면 `--phase` 또는 `--input-dir`을 명시한다. 스크립트 자체에는 특정 phase 기본값이 없다.

```powershell
npm run grafana:stitch -- --phase 03-db-strategies
python scripts/stitch-grafana-captures.py --phase 02-no-lock-baseline
python scripts/stitch-grafana-captures.py `
  --input-dir docs/evidence/02-no-lock-baseline/grafana/parts `
  --metadata docs/evidence/02-no-lock-baseline/grafana/parts/capture-meta.json `
  --output docs/evidence/02-no-lock-baseline/grafana/stitched-dashboard.png
```

## SQL Evidence

Phase 2 baseline 실행 후 SQL consistency evidence를 저장한다.

```powershell
docker compose exec -T postgres psql -U user -d reservation `
  < scripts/sql/phase2-consistency-check.sql `
  > docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
```

## Validation

k6 예약 응답 처리 설정은 다음 명령으로 확인한다.

```powershell
npm run k6:verify-reservation-responses
```

`k6/reservation-test.js`는 `200 reserved`와 `409 sold_out`을 모두 기대 응답으로 처리한다.
