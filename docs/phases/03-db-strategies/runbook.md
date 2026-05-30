# 재실행 절차

Phase 3 기준 부하는 전략별로 하나씩 실행한다. 각 전략 실행 전 DB를 초기화하고, k6 요약 JSON/log/run-window, SQL snapshot, Prometheus 보조 JSON, Grafana screenshot을 같은 실행 단위로 저장한다.

## 사전 조건

프로젝트 루트에서 실행한다.

```bash
make env-check
make db-start
make server-start
```

`make server-start`는 별도 터미널에서 유지한다. k6 setup 단계에서 `POST /api/test/reset`이 HTTP 200을 반환해야 기준 부하가 시작된다.

## 사전 테스트 근거 자료

새 기준 부하를 수집하기 전에 Java 테스트 로그를 남긴다.

```bash
mkdir -p docs/evidence/03-db-strategies/test
cd concurrency
bash ./gradlew test | tee "../docs/evidence/03-db-strategies/test/gradle-test-$(date +%Y%m%d-%H%M%S).log"
```

기대 결과는 `BUILD SUCCESSFUL`이다.

## 비관적 락 기준 부하

터미널 A에서 k6를 실행한다.

```bash
bash k6/run.sh phase3-pessimistic-baseline prometheus
```

k6 실행 직후 터미널 B에서 lock snapshot을 저장한다.

```bash
docker compose exec -T postgres psql -U user -d reservation < scripts/sql/pg-stat-activity-phase3.sql > docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-stat-activity.txt
docker compose exec -T postgres psql -U user -d reservation < scripts/sql/pg-lock-summary.sql > docs/evidence/03-db-strategies/pessimistic-lock/sql/pg-lock-summary.txt
```

k6 종료 후 후속 근거 자료를 저장한다.

```bash
make phase3-sql-consistency STRATEGY=pessimistic-lock
run_window=$(ls -t docs/evidence/03-db-strategies/pessimistic-lock/grafana/run-window-phase3-pessimistic-baseline-prometheus-*.json | head -n 1)
npm run prometheus:phase3 -- --strategy pessimistic-lock --run-window "$run_window" --out-dir docs/evidence/03-db-strategies/pessimistic-lock/prometheus
make phase3-grafana-capture STRATEGY=pessimistic-lock
make phase3-grafana-stitch STRATEGY=pessimistic-lock
```

## 낙관적 락 + 재시도 기준 부하

```bash
bash k6/run.sh phase3-optimistic-baseline prometheus
make phase3-sql-consistency STRATEGY=optimistic-lock
run_window=$(ls -t docs/evidence/03-db-strategies/optimistic-lock/grafana/run-window-phase3-optimistic-baseline-prometheus-*.json | head -n 1)
npm run prometheus:phase3 -- --strategy optimistic-lock --run-window "$run_window" --out-dir docs/evidence/03-db-strategies/optimistic-lock/prometheus
make phase3-grafana-capture STRATEGY=optimistic-lock
make phase3-grafana-stitch STRATEGY=optimistic-lock
```

## 원자적 조건부 UPDATE 기준 부하

```bash
bash k6/run.sh phase3-atomic-baseline prometheus
make phase3-sql-consistency STRATEGY=atomic-update
run_window=$(ls -t docs/evidence/03-db-strategies/atomic-update/grafana/run-window-phase3-atomic-baseline-prometheus-*.json | head -n 1)
npm run prometheus:phase3 -- --strategy atomic-update --run-window "$run_window" --out-dir docs/evidence/03-db-strategies/atomic-update/prometheus
make phase3-grafana-capture STRATEGY=atomic-update
make phase3-grafana-stitch STRATEGY=atomic-update
```

## 기대 근거 자료

각 전략은 다음 파일을 가져야 한다.

- `k6/*-summary.json`
- `logs/*.log`
- `sql/baseline-consistency.txt`
- `prometheus/k6-window-summary.json`
- `grafana/run-window-*.json`
- `grafana/stitched-dashboard.png`

전략별 추가 파일:

- 비관적 락: `sql/pg-stat-activity.txt`, `sql/pg-lock-summary.txt`, `prometheus/pg-locks-count.json`

## 보고서 작성 규칙

`report.md`는 보강된 근거 자료 아래의 새 실행 결과만 사용한다. `archive` 디렉터리의 기존 자료는 과거 기록이며 Phase 3 결론의 근거로 사용하지 않는다.

보고서에는 다음 항목을 포함한다.

- 문제 인식
- 가설
- 실험 설계
- 데이터 개요
- 측정 지표와 원자료 기준
- 핵심 결과
- 근거 자료 목록
- 주장 -> 근거 자료 매트릭스
- 지표 및 이상 징후
- 전략별 분석
- 의사결정
- 한계
- 면접 방어 포인트
- 다음 단계

## 관련 가이드

- [k6 부하 테스트](../../guides/k6-load-testing.md)
- [PostgreSQL 모니터링](../../guides/postgres-monitoring.md)
- [결과 기록](../../guides/result-recording.md)
