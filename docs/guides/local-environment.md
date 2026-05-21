# Local Environment Guide

로컬 실험 환경을 실행하고 점검하기 위한 공통 가이드다. 각 Phase의 `runbook.md`는 필요한 절차만 링크하고, 반복되는 설명은 이 문서에 둔다.

## Services

- Spring Boot application: `localhost:8080`
- PostgreSQL: `localhost:5432`
- Prometheus: `localhost:9090`
- Grafana: `localhost:3000`
- Redis: `localhost:6379`

## Common Flow

1. Docker Compose로 인프라를 실행한다.
2. Spring Boot 애플리케이션을 실행한다.
3. reset API 또는 SQL로 테스트 상태를 초기화한다.
4. k6 시나리오를 실행한다.
5. SQL과 Grafana/Prometheus 지표를 evidence로 저장한다.

## Notes

기존 Docker, Spring, k6 설정 파일은 이 문서 구조 생성 작업에서 수정하지 않는다.
