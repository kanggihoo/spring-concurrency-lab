# Runbook

이 문서는 기본 템플릿이다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

## Steps

1. Docker Compose로 PostgreSQL, Prometheus, Grafana를 실행한다.
2. Spring Boot 애플리케이션을 실행한다.
3. `/actuator/prometheus` 응답을 확인한다.
4. Prometheus targets 화면에서 spring, postgres, redis target 상태를 확인한다.
5. Grafana에 접속해 기본 dashboard 접근을 확인한다.
6. k6 단순 테스트를 실행해 부하 테스트 경로를 확인한다.

## Related Guides

- [Local Environment](../../guides/local-environment.md)
- [k6 Load Testing](../../guides/k6-load-testing.md)
- [Grafana and Prometheus](../../guides/grafana-prometheus.md)
