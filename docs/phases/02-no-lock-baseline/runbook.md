# Runbook

Phase 2 No Lock Baseline을 실행하고 evidence를 남기는 절차다.

## Prerequisites

1. Docker Compose 서비스 실행

   ```powershell
   docker compose up -d postgres postgres_exporter prometheus grafana
   ```

2. Spring Boot 실행

   ```powershell
   cd concurrency
   .\gradlew.bat bootRun
   ```

## Steps

1. Grafana dashboard JSON을 최신 상태로 생성한다.

   ```powershell
   npm run grafana:generate
   ```

2. Phase 2 baseline k6 preset을 실행한다.

   ```powershell
   bash k6/run.sh baseline prometheus
   ```

   `baseline`은 `k6/presets/baseline.json`을 의미하고, `prometheus`는 Docker Compose의 k6 서비스로 실행하면서 Prometheus remote write를 사용한다는 의미다.

3. k6 evidence가 생성됐는지 확인한다.

   ```text
   docs/evidence/02-no-lock-baseline/k6/
   docs/evidence/02-no-lock-baseline/logs/
   docs/evidence/02-no-lock-baseline/grafana/run-window-*.json
   ```

4. SQL consistency evidence를 저장한다.

   ```powershell
   docker compose exec -T postgres psql -U user -d reservation `
     < scripts/sql/phase2-consistency-check.sql `
     > docs/evidence/02-no-lock-baseline/sql/baseline-consistency.txt
   ```

5. Grafana dashboard를 캡처한다.

   ```powershell
   npm run grafana:capture:phase2
   ```

   이 명령은 최신 `docs/evidence/02-no-lock-baseline/grafana/run-window-*.json`을 읽어 k6 실행 구간으로 Grafana `from`/`to`를 고정한다. 캡처 결과는 `docs/evidence/02-no-lock-baseline/grafana/parts/`에 저장된다.

6. Grafana parts 이미지를 하나의 dashboard 이미지로 합친다.

   ```powershell
   npm run grafana:stitch:phase2
   ```

   기본 출력은 `docs/evidence/02-no-lock-baseline/grafana/stitched-dashboard.png`이다.

7. `docs/phases/02-no-lock-baseline/report.md`에 k6 summary, SQL evidence, Grafana evidence를 근거로 결과를 기록한다.

## Related Guides

- [Scripts Guide](../../guides/scripts.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Result Recording](../../guides/result-recording.md)
