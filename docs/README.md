# Spring Concurrency Lab Docs

이 문서는 동시성 처리 비교 학습 프로젝트의 현재 유효 문서 구조를 안내한다.

기존 `docs/00_project-overview.md`, `docs/01_*`, `docs/02_*`, `docs/images/*` 문서는 이동하지 않고 legacy/reference 문서로 보존한다. 새 작업은 아래 구조를 기준으로 진행한다.

## Structure

| Path | Purpose |
|---|---|
| `roadmap/` | Phase 순서, 목표, 완료 기준 |
| `phases/` | 각 Phase의 현재 유효 실행 문서 |
| `guides/` | 반복 실행법과 공통 운영 절차 |
| `evidence/` | k6 결과, SQL snapshot, Grafana screenshot, 로그 |
| `superpowers/specs/` | 설계/spec 문서 |
| `superpowers/plans/` | AI 작업 계획, vertical slice 계획, 실행 계획 |

## Command Interface

반복 실행의 공식 진입점은 루트 `Makefile`이다.

```bash
make help
```

- [Commands Guide](./guides/commands.md)
- [Project Format Standard](./guides/project-format-standard.md)

## Roadmap

- [Overview](./roadmap/00-overview.md)
- [Phase 1. Environment & Observability](./roadmap/01-environment-observability.md)
- [Phase 2. No Lock Baseline](./roadmap/02-no-lock-baseline.md)
- [Phase 3. DB Concurrency Strategies](./roadmap/03-db-strategies.md)
- [Phase 4. DB Operational Limits](./roadmap/04-db-operational-limits.md)
- [Phase 5. Redis Concurrency Strategies](./roadmap/05-redis-strategies.md)
- [Phase 6. Idempotency](./roadmap/06-idempotency.md)
- [Phase 7. WireMock Payment-Adjacent Experiment](./roadmap/07-wiremock-payment-adjacent.md)
- [Phase 8. Final Report](./roadmap/08-final-report.md)

## Phase Document Policy

`docs/phases/<phase>/`에는 현재 Phase를 이해하고, 실행하고, 결과를 판정하기 위한 문서를 둔다.

기본 파일은 `README.md`, `scope.md`, `runbook.md`, `observability.md`, `report.md`이다. 이 템플릿은 시작점이지 강제 스키마가 아니다. Phase 성격에 따라 섹션을 추가하거나 삭제할 수 있다.

단, Phase 완료 여부는 파일 형식 준수가 아니라 증거 기반 결론 존재로 판단한다. 최소한 다음 조건은 충족해야 한다.

- 실행 절차가 재현 가능하다.
- k6, SQL, Grafana/Prometheus 등 필요한 evidence 위치가 연결되어 있다.
- `report.md`에 다음 Phase로 넘길 판단 근거가 있다.
