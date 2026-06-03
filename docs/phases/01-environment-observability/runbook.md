# Runbook

## Steps

1. Docker Compose로 PostgreSQL, postgres_exporter, Prometheus, Grafana를 실행한다.

   ```bash
   docker compose up -d
   ```

2. `concurrency` 모듈에서 Spring Boot 애플리케이션을 실행한다.

   ```bash
   cd concurrency
   ./gradlew bootRun
   ```

   Windows PowerShell에서는 다음 명령을 사용한다.

   ```powershell
   .\gradlew.bat bootRun
   ```

3. Spring Actuator Prometheus endpoint 응답을 확인한다.

   ```bash
   curl http://localhost:8080/actuator/prometheus
   ```

4. Prometheus targets 화면에서 `spring`, `postgres` target 상태를 확인한다.

   ```text
   http://localhost:9090/targets
   ```

5. Grafana에 접속해 Prometheus datasource 또는 dashboard 접근을 확인한다.

   ```text
   http://localhost:3000
   ```

6. reset API로 테스트 상태 초기화 경로를 확인한다.

   ```bash
   curl -X POST http://localhost:8080/api/test/reset
   ```

7. k6 smoke test를 실행해 부하 테스트 경로를 확인한다.

   ```bash
   bash k6/run.sh baseline prometheus
   ```

8. 확인 결과를 `report.md`에 기록한다.

## Related Guides

- [Local Environment](../../guides/local-environment.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Grafana and Prometheus](../../guides/grafana-prometheus.md)
